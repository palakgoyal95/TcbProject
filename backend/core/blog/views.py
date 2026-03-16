import logging
import hashlib
import math
import re
import time

import cloudinary.uploader
from cloudinary.utils import cloudinary_url
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector
from django.db import (
    DataError,
    IntegrityError,
    OperationalError,
    ProgrammingError,
    connection,
    transaction,
)
from django.db.models import F, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .cache_utils import get_or_set_json
from .models import Category, NewsletterSubscriber, Post, PostView
from .serializers import (
    CategorySerializer,
    CommentSerializer,
    ContactMessageSerializer,
    NewsletterSubscriberSerializer,
    PostListSerializer,
    PostSerializer,
)


logger = logging.getLogger(__name__)
INTERNAL_SUGGESTION_LIMIT = 6
INTERNAL_SUGGESTIONS_CACHE_TTL_SECONDS = 15 * 60
POPULAR_POSTS_CACHE_TTL_SECONDS = 15 * 60
POPULAR_POSTS_LIMIT_DEFAULT = 6
POPULAR_POSTS_LIMIT_MAX = 20
SEARCH_PAGE_SIZE_DEFAULT = 12
SEARCH_PAGE_SIZE_MAX = 30
GENERIC_ANCHOR_TEXT = {
    "click here",
    "read more",
    "learn more",
    "more",
    "here",
    "link",
}
POST_LIST_ONLY_FIELDS = (
    "id",
    "title",
    "slug",
    "excerpt",
    "category_id",
    "category__name",
    "author_id",
    "author__username",
    "image",
    "created_at",
    "status",
    "views_count",
)


def _resolve_client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()[:80]

    return str(request.META.get("REMOTE_ADDR", "") or "0.0.0.0")[:80]


def _build_visitor_hash(request):
    ip_address = _resolve_client_ip(request)
    user_agent = str(request.META.get("HTTP_USER_AGENT", "") or "")[:300]
    visitor_raw = f"{ip_address}|{user_agent}|{settings.SECRET_KEY[:24]}"
    return hashlib.sha256(visitor_raw.encode("utf-8")).hexdigest()


def _parse_positive_int(value, default_value, min_value=1, max_value=100):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default_value

    if parsed < min_value:
        return min_value
    if parsed > max_value:
        return max_value
    return parsed


def _project_lightweight_posts(queryset):
    return queryset.select_related("author", "category").only(*POST_LIST_ONLY_FIELDS)


def _tokenize_keywords(text):
    ordered_tokens = []
    seen = set()

    for token in re.findall(r"[a-z0-9]+", str(text or "").lower()):
        if len(token) < 3:
            continue
        if token in seen:
            continue

        seen.add(token)
        ordered_tokens.append(token)

        if len(ordered_tokens) >= 20:
            break

    return ordered_tokens


def _resolve_post_image_url(post):
    image_value = str(getattr(post, "image", "") or "").strip()
    if image_value.startswith("http://") or image_value.startswith("https://"):
        return image_value

    public_id = getattr(getattr(post, "image", None), "public_id", None) or image_value
    if not public_id:
        return None

    try:
        url, _ = cloudinary_url(public_id, secure=True)
        return url
    except Exception:
        return None


def _keyword_overlap_score(seed_tokens, candidate_post):
    if not seed_tokens:
        return 0.0

    candidate_tokens = set(
        _tokenize_keywords(
            f"{candidate_post.title} {candidate_post.excerpt} {candidate_post.content}"
        )
    )
    if not candidate_tokens:
        return 0.0

    overlap_count = len(set(seed_tokens) & candidate_tokens)
    denominator = max(4, min(10, len(set(seed_tokens))))
    return min(1.0, overlap_count / denominator)


def _build_anchor_suggestions(source_post, candidate_post, seed_tokens):
    anchor_candidates = []

    title = str(candidate_post.title or "").strip()
    if title:
        anchor_candidates.append(title)

    source_token_set = set(seed_tokens)
    overlap_tokens = [
        token
        for token in _tokenize_keywords(
            f"{candidate_post.title} {candidate_post.excerpt}"
        )
        if token in source_token_set
    ]
    if len(overlap_tokens) >= 2:
        anchor_candidates.append(" ".join(overlap_tokens[:4]).title())

    if candidate_post.category_id == source_post.category_id and candidate_post.category_id:
        category_name = str(getattr(candidate_post.category, "name", "")).strip()
        if category_name:
            anchor_candidates.append(f"{category_name} insights")

    excerpt_words = str(candidate_post.excerpt or "").strip().split()
    if len(excerpt_words) >= 4:
        anchor_candidates.append(" ".join(excerpt_words[:8]))

    cleaned = []
    seen = set()
    for anchor_text in anchor_candidates:
        normalized = re.sub(r"\s+", " ", str(anchor_text).strip())
        lowered = normalized.lower()
        if len(normalized.split()) < 2:
            continue
        if lowered in GENERIC_ANCHOR_TEXT:
            continue
        if lowered in seen:
            continue
        seen.add(lowered)
        cleaned.append(normalized)

    return cleaned[:3]


def _build_internal_suggestion_payload(source_post):
    seed_tokens = _tokenize_keywords(f"{source_post.title} {source_post.excerpt}")

    suggestions_query = (
        Post.objects.select_related("category")
        .filter(status__iexact="PUBLISHED")
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
        ).order_by("-keyword_score", "-created_at")
    else:
        suggestions_query = suggestions_query.order_by("-created_at")

    scored = []
    for candidate_post in suggestions_query[:40]:
        category_score = 1.0 if candidate_post.category_id == source_post.category_id else 0.0
        if use_postgres_search:
            keyword_score = float(getattr(candidate_post, "keyword_score", 0.0) or 0.0)
        else:
            keyword_score = _keyword_overlap_score(seed_tokens, candidate_post)

        tag_score = 0.0
        ranking_score = (0.55 * category_score) + (0.40 * keyword_score) + (0.05 * tag_score)
        if ranking_score <= 0:
            continue

        match_reasons = []
        if category_score > 0:
            match_reasons.append("shared_category")
        if keyword_score > 0:
            match_reasons.append("keyword_overlap")
        if tag_score > 0:
            match_reasons.append("tag_similarity")

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
                    "tag_similarity": round(tag_score, 4),
                },
                "match_reasons": match_reasons,
                "anchor_suggestions": _build_anchor_suggestions(
                    source_post, candidate_post, seed_tokens
                ),
                "internal_depth": 2,
                "_created_at": candidate_post.created_at,
            }
        )

    scored.sort(key=lambda item: (item["score"], item["_created_at"]), reverse=True)

    suggestions = []
    for row in scored[:INTERNAL_SUGGESTION_LIMIT]:
        row.pop("_created_at", None)
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
        if self.action == "list":
            return _project_lightweight_posts(
                queryset.filter(status__iexact="PUBLISHED")
            )
        if self.action == "retrieve":
            return queryset.filter(status__iexact="PUBLISHED")
        return queryset

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def perform_update(self, serializer):
        post = self.get_object()
        if post.author_id != self.request.user.id:
            raise PermissionDenied("You can only edit your own posts.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.author_id != self.request.user.id:
            raise PermissionDenied("You can only delete your own posts.")
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



@api_view(['GET'])
def author_posts(request, username):

    author = get_object_or_404(User, username=username)

    posts = _project_lightweight_posts(
        Post.objects.filter(
            author=author,
            status__iexact="PUBLISHED"
        )
    )

    serializer = PostListSerializer(posts, many=True)

    return Response(serializer.data)



@api_view(['GET'])
def search_posts(request):

    query = str(request.GET.get("q", "") or "").strip()
    category_value = str(request.GET.get("category", "") or "").strip()
    sort_value = str(request.GET.get("sort", "relevance") or "relevance").strip().lower()

    page = _parse_positive_int(
        request.GET.get("page"),
        default_value=1,
        min_value=1,
        max_value=10000,
    )
    page_size = _parse_positive_int(
        request.GET.get("page_size"),
        default_value=SEARCH_PAGE_SIZE_DEFAULT,
        min_value=1,
        max_value=SEARCH_PAGE_SIZE_MAX,
    )

    normalized_sort = (
        sort_value if sort_value in {"relevance", "date_desc", "date_asc"} else "relevance"
    )

    request_started_at = time.perf_counter()
    base_queryset = Post.objects.filter(status__iexact="PUBLISHED")

    if category_value and category_value != "all":
        if category_value.isdigit():
            base_queryset = base_queryset.filter(category_id=int(category_value))
        else:
            base_queryset = base_queryset.filter(category__slug=category_value)

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
        ordered_queryset = ranked_queryset.order_by("-created_at")
    elif normalized_sort == "date_asc":
        ordered_queryset = ranked_queryset.order_by("created_at")
    else:
        if use_postgres_search:
            ordered_queryset = ranked_queryset.order_by("-relevance", "-created_at")
        else:
            ordered_queryset = ranked_queryset.order_by("-created_at")

    total_count = ordered_queryset.count()
    total_pages = max(1, math.ceil(total_count / page_size)) if total_count else 0
    page = min(page, total_pages) if total_pages else 1

    start_index = (page - 1) * page_size
    end_index = start_index + page_size
    visible_posts = _project_lightweight_posts(ordered_queryset)[start_index:end_index]

    serializer = PostListSerializer(visible_posts, many=True)

    query_time_ms = round((time.perf_counter() - request_started_at) * 1000, 2)
    if query_time_ms > 250:
        logger.warning(
            "search_posts_slow_query q=%s sort=%s page=%s page_size=%s query_time_ms=%s",
            query,
            normalized_sort,
            page,
            page_size,
            query_time_ms,
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

    source_post = get_object_or_404(
        Post.objects.select_related("author", "category"),
        id=post_id,
    )

    if source_post.status != Post.Status.PUBLISHED:
        if not request.user or not request.user.is_authenticated:
            raise PermissionDenied("Authentication required for draft suggestions.")
        if request.user.id != source_post.author_id:
            raise PermissionDenied("You can only request suggestions for your own drafts.")

    request_started_at = time.perf_counter()

    cached_payload, cache_hit = get_or_set_json(
        namespace="internal-suggestions",
        cache_args={"post_id": source_post.id},
        ttl_seconds=INTERNAL_SUGGESTIONS_CACHE_TTL_SECONDS,
        producer=lambda: _build_internal_suggestion_payload(source_post),
    )

    query_time_ms = round((time.perf_counter() - request_started_at) * 1000, 2)

    if query_time_ms > 250:
        logger.warning(
            "internal_suggestions_slow_query post_id=%s cache_hit=%s query_time_ms=%s",
            source_post.id,
            cache_hit,
            query_time_ms,
        )

    response_payload = {
        **cached_payload,
        "meta": {
            "cache_hit": cache_hit,
            "cache_ttl_seconds": INTERNAL_SUGGESTIONS_CACHE_TTL_SECONDS,
            "query_time_ms": query_time_ms,
        },
    }

    return Response(response_payload)


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def popular_posts(request):
    raw_limit = request.GET.get("limit", POPULAR_POSTS_LIMIT_DEFAULT)
    try:
        parsed_limit = int(raw_limit)
    except (TypeError, ValueError):
        parsed_limit = POPULAR_POSTS_LIMIT_DEFAULT

    limit = min(max(1, parsed_limit), POPULAR_POSTS_LIMIT_MAX)

    request_started_at = time.perf_counter()

    cached_payload, cache_hit = get_or_set_json(
        namespace="popular-posts",
        cache_args={"limit": limit},
        ttl_seconds=POPULAR_POSTS_CACHE_TTL_SECONDS,
        producer=lambda: PostListSerializer(
            _project_lightweight_posts(
                Post.objects.filter(status__iexact="PUBLISHED")
                .order_by("-views_count", "-created_at")
            )[:limit],
            many=True,
        ).data,
    )

    query_time_ms = round((time.perf_counter() - request_started_at) * 1000, 2)

    if query_time_ms > 250:
        logger.warning(
            "popular_posts_slow_query limit=%s cache_hit=%s query_time_ms=%s",
            limit,
            cache_hit,
            query_time_ms,
        )

    return Response(
        {
            "results": cached_payload,
            "meta": {
                "cache_hit": cache_hit,
                "cache_ttl_seconds": POPULAR_POSTS_CACHE_TTL_SECONDS,
                "query_time_ms": query_time_ms,
            },
        }
    )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def track_post_view(request, slug):
    post = get_object_or_404(
        Post.objects.only("id", "slug", "status", "views_count"),
        slug=slug,
        status__iexact="PUBLISHED",
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
        return Response(
            {"detail": "Invalid event_type."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    logger.info(
        "search_analytics_event type=%s source=%s query=%s result_count=%s clicked_slug=%s",
        event_type,
        source,
        query,
        result_count,
        clicked_slug,
    )

    return Response({"status": "recorded"}, status=status.HTTP_202_ACCEPTED)

@api_view(['GET'])
def category_posts(request, slug):

    category = get_object_or_404(Category, slug=slug)

    posts = _project_lightweight_posts(
        Post.objects.filter(
            category=category,
            status__iexact="PUBLISHED"
        )
    )

    serializer = PostListSerializer(posts, many=True)

    return Response(serializer.data)

@api_view(['GET'])
def categories(request):

    categories = Category.objects.all()

    serializer = CategorySerializer(categories, many=True)

    return Response(serializer.data)  
  
@api_view(["GET", "POST"])
@permission_classes([permissions.AllowAny])
def post_comments(request, slug):

    post = get_object_or_404(Post, slug=slug, status__iexact="PUBLISHED")

    if request.method == "GET":
        comments = post.comments.select_related("user").all().order_by("-created_at")
        serializer = CommentSerializer(comments, many=True)
        return Response(serializer.data)

    if not request.user or not request.user.is_authenticated:
        return Response(
            {"detail": "Authentication credentials were not provided."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    serializer = CommentSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(post=post, user=request.user)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_image(request):
    file_obj = request.FILES.get("file")
    folder = request.data.get("folder", "tcb-uploads")

    if not file_obj:
        return Response({"detail": "No file provided."}, status=400)

    try:
        upload_result = cloudinary.uploader.upload(file_obj, folder=folder)
        return Response(
            {
                "secure_url": upload_result.get("secure_url"),
                "public_id": upload_result.get("public_id"),
            }
        )
    except Exception as error:
        return Response({"detail": str(error)}, status=400)


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def subscribe(request):
    serializer = NewsletterSubscriberSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    email = serializer.validated_data["email"]
    try:
        subscriber, created = NewsletterSubscriber.objects.get_or_create(
            email=email,
            defaults={"is_active": True},
        )
    except (ProgrammingError, OperationalError):
        return Response(
            {
                "detail": (
                    "Subscription storage is not ready. "
                    "Run migrations (`python manage.py migrate`) and retry."
                )
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    if not created and not subscriber.is_active:
        subscriber.is_active = True
        subscriber.save(update_fields=["is_active"])
        created = True

    response_payload = {
        "detail": (
            "Subscription confirmed."
            if created
            else "You are already subscribed with this email."
        ),
        "status": "subscribed" if created else "already_subscribed",
        "email": subscriber.email,
    }

    return Response(
        response_payload,
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def contact(request):
    serializer = ContactMessageSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        serializer.save()
    except (ProgrammingError, OperationalError):
        return Response(
            {
                "detail": (
                    "Contact storage is not ready. "
                    "Run migrations (`python manage.py migrate`) and retry."
                )
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return Response(
        {"detail": "Message sent successfully. Our team will reach out soon."},
        status=status.HTTP_201_CREATED,
    )
