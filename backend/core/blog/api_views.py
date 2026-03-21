import math
import time

from django.contrib.auth.models import User
from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
from django.db import DataError, IntegrityError, OperationalError, ProgrammingError, connection, transaction
from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from .cache_utils import get_or_set_json
from .models import AnalyticsEvent, Category, EditorialAutosave, NewsletterSubscriber, Post, PostView
from .serializers import (
    CategorySerializer,
    CommentSerializer,
    ContactMessageSerializer,
    EditorialAutosaveSerializer,
    NewsletterSubscriberSerializer,
    PostListSerializer,
    PostSerializer,
)
from .views import (
    GENERIC_ANCHOR_TEXT,
    INTERNAL_SUGGESTION_LIMIT,
    INTERNAL_SUGGESTIONS_CACHE_TTL_SECONDS,
    POPULAR_POSTS_CACHE_TTL_SECONDS,
    POPULAR_POSTS_LIMIT_DEFAULT,
    POPULAR_POSTS_LIMIT_MAX,
    SEARCH_PAGE_SIZE_DEFAULT,
    SEARCH_PAGE_SIZE_MAX,
    _build_anchor_suggestions,
    _build_visitor_hash,
    _keyword_overlap_score,
    _parse_positive_int,
    _project_lightweight_posts,
    _resolve_post_image_url,
    _tokenize_keywords,
    contact,
    logger,
    subscribe,
    upload_image,
)


EDITORIAL_AUTOSAVE_DEFAULT_KEY = "new-post"


def _live_post_filter(at_time=None):
    effective_time = at_time or timezone.now()
    return (
        Q(status=Post.Status.PUBLISHED)
        & (
            Q(published_at__lte=effective_time)
            | (Q(published_at__isnull=True) & Q(created_at__lte=effective_time))
        )
    )


def _can_manage_post(user, post):
    return bool(
        user
        and user.is_authenticated
        and (user.is_staff or user.is_superuser or post.author_id == user.id)
    )


def _can_schedule_post(user):
    return bool(
        user
        and user.is_authenticated
        and (user.is_staff or user.is_superuser or user.has_perm("blog.publish_post"))
    )


def _resolve_publication_state(
    *,
    requested_status,
    scheduled_for,
    existing_post=None,
    user=None,
    schedule_touched=True,
):
    now = timezone.now()

    if requested_status != Post.Status.PUBLISHED:
        return {
            "status": Post.Status.DRAFT,
            "scheduled_for": None,
            "published_at": None,
        }

    if scheduled_for and scheduled_for > now:
        if schedule_touched and not _can_schedule_post(user):
            raise PermissionDenied("Scheduling publication requires an editor or admin role.")
        return {
            "status": Post.Status.PUBLISHED,
            "scheduled_for": scheduled_for,
            "published_at": scheduled_for,
        }

    existing_published_at = getattr(existing_post, "published_at", None)
    published_at = existing_published_at if existing_published_at and existing_published_at <= now else now
    return {
        "status": Post.Status.PUBLISHED,
        "scheduled_for": None,
        "published_at": published_at,
    }


def _record_analytics_event(
    event_type,
    *,
    post=None,
    user=None,
    query="",
    source="",
    visitor_hash="",
    result_count=0,
    depth_percent=None,
    metadata=None,
):
    try:
        AnalyticsEvent.objects.create(
            event_type=event_type,
            post=post,
            user=user if getattr(user, "is_authenticated", False) else None,
            query=str(query or "")[:120],
            source=str(source or "")[:60],
            visitor_hash=str(visitor_hash or "")[:64],
            result_count=max(0, int(result_count or 0)),
            depth_percent=depth_percent,
            metadata=metadata or {},
        )
    except (ProgrammingError, OperationalError):
        logger.warning("analytics_event_storage_unavailable type=%s", event_type)


def _resolve_autosave_post(post_id, user):
    if not post_id:
        return None

    post = get_object_or_404(Post, id=post_id)
    if not _can_manage_post(user, post):
        raise PermissionDenied("You can only autosave drafts for posts you manage.")
    return post


def _build_internal_suggestion_payload(source_post):
    seed_tokens = _tokenize_keywords(f"{source_post.title} {source_post.excerpt}")

    suggestions_query = (
        Post.objects.select_related("category")
        .filter(_live_post_filter())
        .exclude(id=source_post.id)
    )

    if seed_tokens:
        discovery_filter = Q(category_id=source_post.category_id)
        for token in seed_tokens[:8]:
            discovery_filter |= (
                Q(title__icontains=token)
                | Q(excerpt__icontains=token)
                | Q(content__icontains=token)
            )
        suggestions_query = suggestions_query.filter(discovery_filter)
    else:
        suggestions_query = suggestions_query.filter(category_id=source_post.category_id)

    use_postgres_search = connection.vendor == "postgresql" and bool(seed_tokens)
    if use_postgres_search:
        query_text = " OR ".join(seed_tokens[:8])
        search_query = SearchQuery(query_text, search_type="websearch", config="english")
        search_vector = (
            SearchVector("title", weight="A", config="english")
            + SearchVector("excerpt", weight="B", config="english")
            + SearchVector("content", weight="C", config="english")
        )
        suggestions_query = suggestions_query.annotate(
            keyword_score=SearchRank(search_vector, search_query)
        ).order_by("-keyword_score", "-published_at", "-created_at")
    else:
        suggestions_query = suggestions_query.order_by("-published_at", "-created_at")

    scored = []
    for candidate_post in suggestions_query[:40]:
        category_score = 1.0 if candidate_post.category_id == source_post.category_id else 0.0
        if use_postgres_search:
            keyword_score = float(getattr(candidate_post, "keyword_score", 0.0) or 0.0)
        else:
            keyword_score = _keyword_overlap_score(seed_tokens, candidate_post)

        ranking_score = (0.55 * category_score) + (0.45 * keyword_score)
        if ranking_score <= 0:
            continue

        match_reasons = []
        if category_score > 0:
            match_reasons.append("shared_category")
        if keyword_score > 0:
            match_reasons.append("keyword_overlap")

        scored.append(
            {
                "id": candidate_post.id,
                "slug": candidate_post.slug,
                "title": candidate_post.title,
                "excerpt": str(candidate_post.excerpt or "").strip()[:220],
                "category_name": getattr(candidate_post.category, "name", "General"),
                "image_url": _resolve_post_image_url(candidate_post),
                "score": round(ranking_score, 4),
                "score_breakdown": {
                    "shared_category": round(category_score, 4),
                    "keyword_overlap": round(keyword_score, 4),
                },
                "match_reasons": match_reasons,
                "anchor_suggestions": _build_anchor_suggestions(
                    source_post,
                    candidate_post,
                    seed_tokens,
                ),
                "internal_depth": 2,
                "_published_at": candidate_post.published_at or candidate_post.created_at,
            }
        )

    scored.sort(key=lambda item: (item["score"], item["_published_at"]), reverse=True)

    suggestions = []
    for row in scored[:INTERNAL_SUGGESTION_LIMIT]:
        row.pop("_published_at", None)
        suggestions.append(row)

    return {
        "post_id": source_post.id,
        "generated_at": timezone.now().isoformat(),
        "suggestions": suggestions,
    }


class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.select_related("author", "category").all()
    serializer_class = PostSerializer
    lookup_field = "slug"

    def get_serializer_class(self):
        if self.action == "list":
            return PostListSerializer
        return PostSerializer

    def get_permissions(self):
        if self.action in ["create", "update", "partial_update", "destroy"]:
            return [permissions.IsAuthenticated()]
        return [permissions.AllowAny()]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = getattr(self.request, "user", None)

        if self.action == "list":
            return _project_lightweight_posts(
                queryset.filter(_live_post_filter()).order_by("-published_at", "-created_at")
            )

        if self.action == "retrieve":
            if user and user.is_authenticated:
                if user.is_staff or user.is_superuser:
                    return queryset
                return queryset.filter(_live_post_filter() | Q(author=user))
            return queryset.filter(_live_post_filter())

        if user and user.is_authenticated and (user.is_staff or user.is_superuser):
            return queryset

        if user and user.is_authenticated:
            return queryset.filter(Q(author=user) | _live_post_filter())

        return queryset.filter(_live_post_filter())

    def perform_create(self, serializer):
        publication_state = _resolve_publication_state(
            requested_status=serializer.validated_data.get("status", Post.Status.DRAFT),
            scheduled_for=serializer.validated_data.get("scheduled_for"),
            user=self.request.user,
            schedule_touched=True,
        )
        post = serializer.save(author=self.request.user, **publication_state)

        if publication_state["status"] == Post.Status.PUBLISHED:
            _record_analytics_event(
                AnalyticsEvent.EventType.PUBLISH,
                post=post,
                user=self.request.user,
                source="post-create",
                metadata={
                    "slug": post.slug,
                    "scheduled_for": (
                        publication_state["scheduled_for"].isoformat()
                        if publication_state["scheduled_for"]
                        else ""
                    ),
                },
            )

    def perform_update(self, serializer):
        post = self.get_object()
        if not _can_manage_post(self.request.user, post):
            raise PermissionDenied("You can only edit posts you authored.")

        schedule_touched = "scheduled_for" in serializer.validated_data
        publication_state = _resolve_publication_state(
            requested_status=serializer.validated_data.get("status", post.status),
            scheduled_for=serializer.validated_data.get("scheduled_for", post.scheduled_for),
            existing_post=post,
            user=self.request.user,
            schedule_touched=schedule_touched,
        )
        updated_post = serializer.save(**publication_state)

        if publication_state["status"] == Post.Status.PUBLISHED:
            _record_analytics_event(
                AnalyticsEvent.EventType.PUBLISH,
                post=updated_post,
                user=self.request.user,
                source="post-update",
                metadata={
                    "slug": updated_post.slug,
                    "scheduled_for": (
                        publication_state["scheduled_for"].isoformat()
                        if publication_state["scheduled_for"]
                        else ""
                    ),
                },
            )

    def perform_destroy(self, instance):
        if not _can_manage_post(self.request.user, instance):
            raise PermissionDenied("You can only delete posts you authored.")
        instance.delete()

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except DataError:
            return Response(
                {
                    "detail": (
                        "Database rejected one or more values (often field length). "
                        "If you changed model limits recently, run migrations."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except IntegrityError:
            return Response(
                {"detail": "Could not create post due to a database integrity constraint."},
                status=status.HTTP_400_BAD_REQUEST,
            )


@api_view(["GET"])
def author_posts(request, username):
    author = get_object_or_404(User, username=username)
    base_queryset = Post.objects.filter(author=author)
    request_user = getattr(request, "user", None)
    can_view_private_posts = bool(
        request_user
        and request_user.is_authenticated
        and (
            request_user.is_staff
            or request_user.is_superuser
            or request_user.id == author.id
        )
    )

    if can_view_private_posts:
        posts = _project_lightweight_posts(
            base_queryset.order_by("-published_at", "-created_at")
        )
    else:
        posts = _project_lightweight_posts(
            base_queryset.filter(_live_post_filter()).order_by("-published_at", "-created_at")
        )
    return Response(PostListSerializer(posts, many=True).data)


@api_view(["GET"])
def search_posts(request):
    query = str(request.GET.get("q", "") or "").strip()
    category_value = str(request.GET.get("category", "") or "").strip()
    sort_value = str(request.GET.get("sort", "relevance") or "relevance").strip().lower()

    page = _parse_positive_int(request.GET.get("page"), default_value=1, min_value=1, max_value=10000)
    page_size = _parse_positive_int(
        request.GET.get("page_size"),
        default_value=SEARCH_PAGE_SIZE_DEFAULT,
        min_value=1,
        max_value=SEARCH_PAGE_SIZE_MAX,
    )
    normalized_sort = sort_value if sort_value in {"relevance", "date_desc", "date_asc"} else "relevance"

    request_started_at = time.perf_counter()
    base_queryset = Post.objects.filter(_live_post_filter())

    if category_value and category_value != "all":
        base_queryset = (
            base_queryset.filter(category_id=int(category_value))
            if category_value.isdigit()
            else base_queryset.filter(category__slug=category_value)
        )

    if not query:
        query_time_ms = round((time.perf_counter() - request_started_at) * 1000, 2)
        return Response(
            {
                "results": [],
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total_count": 0,
                    "total_pages": 0,
                    "has_next": False,
                    "has_previous": False,
                },
                "meta": {
                    "query": query,
                    "sort": normalized_sort,
                    "query_time_ms": query_time_ms,
                    "terms": [],
                },
            }
        )

    terms = _tokenize_keywords(query)[:8]
    use_postgres_search = connection.vendor == "postgresql"

    if use_postgres_search:
        search_query = SearchQuery(query, search_type="websearch", config="english")
        search_vector = (
            SearchVector("title", weight="A", config="english")
            + SearchVector("search_headings", weight="B", config="english")
            + SearchVector("content", weight="C", config="english")
        )
        ranked_queryset = base_queryset.annotate(
            relevance=SearchRank(search_vector, search_query)
        ).filter(relevance__gt=0)
    else:
        fallback_filter = Q(title__icontains=query) | Q(search_headings__icontains=query) | Q(content__icontains=query)
        for term in terms:
            fallback_filter |= (
                Q(title__icontains=term)
                | Q(search_headings__icontains=term)
                | Q(content__icontains=term)
            )
        ranked_queryset = base_queryset.filter(fallback_filter)

    if normalized_sort == "date_desc":
        ordered_queryset = ranked_queryset.order_by("-published_at", "-created_at")
    elif normalized_sort == "date_asc":
        ordered_queryset = ranked_queryset.order_by("published_at", "created_at")
    elif use_postgres_search:
        ordered_queryset = ranked_queryset.order_by("-relevance", "-published_at", "-created_at")
    else:
        ordered_queryset = ranked_queryset.order_by("-published_at", "-created_at")

    total_count = ordered_queryset.count()
    total_pages = max(1, math.ceil(total_count / page_size)) if total_count else 0
    page = min(page, total_pages) if total_pages else 1

    start_index = (page - 1) * page_size
    end_index = start_index + page_size
    visible_posts = _project_lightweight_posts(ordered_queryset)[start_index:end_index]
    serializer = PostListSerializer(visible_posts, many=True)

    query_time_ms = round((time.perf_counter() - request_started_at) * 1000, 2)
    _record_analytics_event(
        AnalyticsEvent.EventType.SEARCH,
        user=request.user,
        query=query,
        source="search-endpoint",
        visitor_hash=_build_visitor_hash(request),
        result_count=total_count,
        metadata={"sort": normalized_sort, "category": category_value or "all"},
    )

    return Response(
        {
            "results": serializer.data,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total_count": total_count,
                "total_pages": total_pages,
                "has_next": total_pages > 0 and page < total_pages,
                "has_previous": total_pages > 0 and page > 1,
            },
            "meta": {
                "query": query,
                "sort": normalized_sort,
                "query_time_ms": query_time_ms,
                "terms": terms,
            },
        }
    )


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def internal_suggestions(request, post_id):
    source_post = get_object_or_404(Post.objects.select_related("author", "category"), id=post_id)

    if not source_post.published_at or source_post.published_at > timezone.now():
        if not request.user or not request.user.is_authenticated:
            raise PermissionDenied("Authentication required for draft suggestions.")
        if not _can_manage_post(request.user, source_post):
            raise PermissionDenied("You can only request suggestions for your own drafts.")

    request_started_at = time.perf_counter()
    cached_payload, cache_hit = get_or_set_json(
        namespace="internal-suggestions",
        cache_args={"post_id": source_post.id},
        ttl_seconds=INTERNAL_SUGGESTIONS_CACHE_TTL_SECONDS,
        producer=lambda: _build_internal_suggestion_payload(source_post),
    )
    query_time_ms = round((time.perf_counter() - request_started_at) * 1000, 2)

    return Response(
        {
            **cached_payload,
            "meta": {
                "cache_hit": cache_hit,
                "cache_ttl_seconds": INTERNAL_SUGGESTIONS_CACHE_TTL_SECONDS,
                "query_time_ms": query_time_ms,
            },
        }
    )


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def popular_posts(request):
    raw_limit = request.GET.get("limit", POPULAR_POSTS_LIMIT_DEFAULT)
    try:
        parsed_limit = int(raw_limit)
    except (TypeError, ValueError):
        parsed_limit = POPULAR_POSTS_LIMIT_DEFAULT

    limit = min(max(1, parsed_limit), POPULAR_POSTS_LIMIT_MAX)
    cached_payload, cache_hit = get_or_set_json(
        namespace="popular-posts",
        cache_args={"limit": limit},
        ttl_seconds=POPULAR_POSTS_CACHE_TTL_SECONDS,
        producer=lambda: PostListSerializer(
            _project_lightweight_posts(
                Post.objects.filter(_live_post_filter()).order_by(
                    "-views_count",
                    "-published_at",
                    "-created_at",
                )
            )[:limit],
            many=True,
        ).data,
    )

    return Response(
        {
            "results": cached_payload,
            "meta": {
                "cache_hit": cache_hit,
                "cache_ttl_seconds": POPULAR_POSTS_CACHE_TTL_SECONDS,
            },
        }
    )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def track_post_view(request, slug):
    post = get_object_or_404(
        Post.objects.only("id", "slug", "status", "views_count", "published_at").filter(
            _live_post_filter()
        ),
        slug=slug,
    )

    today = timezone.now().date()
    visitor_hash = _build_visitor_hash(request)

    created = False
    try:
        with transaction.atomic():
            _, created = PostView.objects.get_or_create(
                post_id=post.id,
                view_date=today,
                visitor_hash=visitor_hash,
            )
            if created:
                Post.objects.filter(id=post.id).update(views_count=F("views_count") + 1)
    except IntegrityError:
        created = False

    post.refresh_from_db(fields=["views_count"])
    return Response(
        {
            "status": "counted" if created else "already_counted",
            "views_count": post.views_count,
            "view_date": str(today),
        },
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def search_analytics(request):
    event_type = str(request.data.get("event_type", "") or "").strip().lower()
    query = str(request.data.get("query", "") or "").strip()[:120]
    source = str(request.data.get("source", "") or "unknown").strip()[:60]
    clicked_slug = str(request.data.get("clicked_slug", "") or "").strip()[:200]
    result_count = _parse_positive_int(
        request.data.get("result_count"),
        default_value=0,
        min_value=0,
        max_value=10000,
    )

    allowed_event_types = {"search_impression", "preview_impression", "result_click"}
    if event_type not in allowed_event_types:
        return Response({"detail": "Invalid event_type."}, status=status.HTTP_400_BAD_REQUEST)

    clicked_post = None
    if clicked_slug:
        clicked_post = Post.objects.filter(slug=clicked_slug).only("id").first()

    _record_analytics_event(
        AnalyticsEvent.EventType.SEARCH,
        post=clicked_post,
        user=request.user,
        query=query,
        source=source,
        visitor_hash=_build_visitor_hash(request),
        result_count=result_count,
        metadata={"event_type": event_type, "clicked_slug": clicked_slug},
    )
    return Response({"status": "recorded"}, status=status.HTTP_202_ACCEPTED)


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def engagement_analytics(request):
    depth_percent = _parse_positive_int(
        request.data.get("depth_percent"),
        default_value=0,
        min_value=0,
        max_value=100,
    )
    if depth_percent <= 0:
        return Response({"detail": "depth_percent is required."}, status=status.HTTP_400_BAD_REQUEST)

    slug = str(request.data.get("slug", "") or "").strip()
    post_id = request.data.get("post_id")
    source = str(request.data.get("source", "") or "article-page").strip()[:60]
    post = None

    if slug:
        post = Post.objects.filter(slug=slug).only("id").first()
    elif post_id:
        post = Post.objects.filter(id=post_id).only("id").first()

    _record_analytics_event(
        AnalyticsEvent.EventType.SCROLL_DEPTH,
        post=post,
        user=request.user,
        source=source,
        visitor_hash=_build_visitor_hash(request),
        depth_percent=depth_percent,
        metadata={"slug": slug},
    )
    return Response({"status": "recorded"}, status=status.HTTP_202_ACCEPTED)


@api_view(["GET", "PUT"])
@permission_classes([permissions.IsAuthenticated])
def editorial_autosave(request):
    if request.method == "GET":
        draft_key = str(request.GET.get("draft_key", EDITORIAL_AUTOSAVE_DEFAULT_KEY) or "").strip()
        draft_key = draft_key[:80] or EDITORIAL_AUTOSAVE_DEFAULT_KEY
        autosave = EditorialAutosave.objects.select_related("post").filter(
            author=request.user,
            draft_key=draft_key,
        ).first()
        if not autosave:
            return Response(
                {
                    "draft_key": draft_key,
                    "payload": {},
                    "word_count": 0,
                    "updated_at": None,
                    "created_at": None,
                }
            )
        return Response(EditorialAutosaveSerializer(autosave).data)

    serializer_input = {
        "draft_key": request.data.get("draft_key", EDITORIAL_AUTOSAVE_DEFAULT_KEY),
        "post": request.data.get("post"),
        "payload": request.data.get("payload", {}),
    }

    draft_key = str(serializer_input["draft_key"] or "").strip()[:80] or EDITORIAL_AUTOSAVE_DEFAULT_KEY
    existing = EditorialAutosave.objects.filter(author=request.user, draft_key=draft_key).first()
    serializer = EditorialAutosaveSerializer(existing, data=serializer_input)
    serializer.is_valid(raise_exception=True)

    post = _resolve_autosave_post(serializer.validated_data.get("post"), request.user)
    autosave = serializer.save(author=request.user, draft_key=draft_key, post=post)
    return Response(
        EditorialAutosaveSerializer(autosave).data,
        status=status.HTTP_200_OK if existing else status.HTTP_201_CREATED,
    )


@api_view(["GET"])
def category_posts(request, slug):
    category = get_object_or_404(Category, slug=slug)
    posts = _project_lightweight_posts(
        Post.objects.filter(category=category)
        .filter(_live_post_filter())
        .order_by("-published_at", "-created_at")
    )
    return Response(PostListSerializer(posts, many=True).data)


@api_view(["GET"])
def categories(request):
    return Response(CategorySerializer(Category.objects.all(), many=True).data)


@api_view(["GET", "POST"])
@permission_classes([permissions.AllowAny])
def post_comments(request, slug):
    post = get_object_or_404(Post.objects.filter(_live_post_filter()), slug=slug)

    if request.method == "GET":
        comments = post.comments.select_related("user").all().order_by("-created_at")
        return Response(CommentSerializer(comments, many=True).data)

    if not request.user or not request.user.is_authenticated:
        return Response(
            {"detail": "Authentication credentials were not provided."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    serializer = CommentSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(post=post, user=request.user)
    return Response(serializer.data, status=status.HTTP_201_CREATED)
