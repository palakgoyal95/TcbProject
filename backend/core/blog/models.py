from cloudinary.models import CloudinaryField
from django.contrib.auth.models import User
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVector
from django.db import models
from django.utils import timezone

from .editorial import (
    build_seo_preview,
    build_slug_preview,
    estimate_reading_time_minutes,
    estimate_word_count,
    extract_content_blocks_from_html,
    extract_headings_from_html,
    normalize_faq_blocks,
    render_content_blocks_to_html,
)


class Category(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)

    def __str__(self):
        return self.name


class Post(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PUBLISHED = "PUBLISHED", "Published"

    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, max_length=200)
    excerpt = models.TextField()
    content = models.TextField()
    content_blocks = models.JSONField(default=list, blank=True)
    search_headings = models.TextField(blank=True, default="")
    faq_blocks = models.JSONField(default=list, blank=True)
    seo_title = models.CharField(max_length=70, blank=True, default="")
    seo_description = models.CharField(max_length=170, blank=True, default="")
    canonical_url = models.URLField(blank=True, default="")
    seo_noindex = models.BooleanField(default=False)
    scheduled_for = models.DateTimeField(null=True, blank=True, db_index=True)
    published_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_edited_at = models.DateTimeField(auto_now=True)
    is_sponsored = models.BooleanField(default=False)
    disclosure_text = models.CharField(max_length=240, blank=True, default="")
    premium_enabled = models.BooleanField(default=False)
    ad_slots = models.JSONField(default=dict, blank=True)

    category = models.ForeignKey(Category, on_delete=models.CASCADE)
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    image = CloudinaryField("image")
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    views_count = models.PositiveIntegerField(default=0, db_index=True)

    class Meta:
        permissions = [
            ("publish_post", "Can schedule publication for posts"),
        ]
        indexes = [
            models.Index(fields=["status", "-created_at"], name="post_status_date_idx"),
            models.Index(fields=["status", "published_at"], name="post_status_publish_idx"),
            GinIndex(
                SearchVector("title", weight="A", config="english")
                + SearchVector("search_headings", weight="B", config="english")
                + SearchVector("content", weight="C", config="english"),
                name="post_search_vector_gin",
            ),
        ]

    @property
    def word_count(self):
        return estimate_word_count(content=self.content, faq_blocks=self.faq_blocks)

    @property
    def reading_time_minutes(self):
        return estimate_reading_time_minutes(content=self.content, faq_blocks=self.faq_blocks)

    @property
    def slug_preview(self):
        return build_slug_preview(self.slug)

    @property
    def seo_preview(self):
        return build_seo_preview(
            title=self.title,
            seo_title=self.seo_title,
            excerpt=self.excerpt,
            seo_description=self.seo_description,
            slug=self.slug,
        )

    def save(self, *args, **kwargs):
        self.faq_blocks = normalize_faq_blocks(self.faq_blocks)

        if self.content_blocks and not str(self.content or "").strip():
            self.content = render_content_blocks_to_html(self.content_blocks)
        elif str(self.content or "").strip():
            self.content_blocks = extract_content_blocks_from_html(
                self.content,
                faq_blocks=self.faq_blocks,
            )
        else:
            self.content_blocks = []

        self.search_headings = extract_headings_from_html(self.content)
        self.seo_title = str(self.seo_title or self.title or "").strip()[:70]
        self.seo_description = str(self.seo_description or self.excerpt or "").strip()[:170]

        if self.status == self.Status.PUBLISHED:
            now = timezone.now()
            if self.scheduled_for and self.scheduled_for > now:
                self.published_at = self.scheduled_for
            elif not self.published_at:
                self.published_at = now
        else:
            self.published_at = None
            self.scheduled_for = None

        if not self.disclosure_text and self.is_sponsored:
            self.disclosure_text = "Sponsored content. Editorial review policies still apply."

        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class EditorialAutosave(models.Model):
    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="editorial_autosaves",
    )
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="autosaves",
        null=True,
        blank=True,
    )
    draft_key = models.CharField(max_length=80, default="new-post")
    payload = models.JSONField(default=dict, blank=True)
    word_count = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["author", "draft_key"],
                name="unique_editorial_autosave_per_author_key",
            )
        ]
        indexes = [
            models.Index(fields=["author", "-updated_at"], name="autosave_author_updated_idx"),
            models.Index(fields=["draft_key"], name="autosave_key_idx"),
        ]

    def __str__(self):
        return f"{self.author.username}:{self.draft_key}"


class Comment(models.Model):
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Comment by {self.user} on {self.post}"


class PostView(models.Model):
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="post_views",
    )
    view_date = models.DateField()
    visitor_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["post", "view_date", "visitor_hash"],
                name="unique_daily_post_view",
            )
        ]
        indexes = [
            models.Index(fields=["post", "view_date"], name="postview_post_date_idx"),
            models.Index(fields=["view_date"], name="postview_date_idx"),
            models.Index(fields=["visitor_hash"], name="postview_hash_idx"),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.post_id}:{self.view_date}"


class NewsletterSubscriber(models.Model):
    email = models.EmailField(unique=True)
    is_active = models.BooleanField(default=True)
    subscribed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-subscribed_at"]

    def __str__(self):
        return self.email


class ContactMessage(models.Model):
    class Status(models.TextChoices):
        NEW = "NEW", "New"
        REVIEWED = "REVIEWED", "Reviewed"
        CLOSED = "CLOSED", "Closed"

    name = models.CharField(max_length=120)
    email = models.EmailField()
    subject = models.CharField(max_length=180)
    message = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} - {self.subject}"


class AnalyticsEvent(models.Model):
    class EventType(models.TextChoices):
        PUBLISH = "PUBLISH", "Publish"
        SEARCH = "SEARCH", "Search"
        SCROLL_DEPTH = "SCROLL_DEPTH", "Scroll Depth"

    event_type = models.CharField(max_length=30, choices=EventType.choices)
    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="analytics_events",
        null=True,
        blank=True,
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="analytics_events",
        null=True,
        blank=True,
    )
    query = models.CharField(max_length=120, blank=True, default="")
    source = models.CharField(max_length=60, blank=True, default="")
    visitor_hash = models.CharField(max_length=64, blank=True, default="")
    result_count = models.PositiveIntegerField(default=0)
    depth_percent = models.PositiveSmallIntegerField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["event_type", "-created_at"], name="analytic_type_created_idx"),
            models.Index(fields=["query"], name="analytic_query_idx"),
            models.Index(fields=["post", "event_type"], name="analytic_post_type_idx"),
        ]

    def __str__(self):
        return f"{self.event_type}:{self.post_id or 'site'}"
