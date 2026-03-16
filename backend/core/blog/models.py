import re
from html import unescape

from django.contrib.auth.models import User
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVector
from django.db import models
from cloudinary.models import CloudinaryField

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
    search_headings = models.TextField(blank=True, default="")
    faq_blocks = models.JSONField(default=list, blank=True)

    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE
    )

    author = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )

    image = CloudinaryField('image')

    created_at = models.DateTimeField(auto_now_add=True)

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT
    )
    views_count = models.PositiveIntegerField(default=0, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["status", "-created_at"], name="post_status_date_idx"),
            GinIndex(
                SearchVector("title", weight="A", config="english")
                + SearchVector("search_headings", weight="B", config="english")
                + SearchVector("content", weight="C", config="english"),
                name="post_search_vector_gin",
            ),
        ]

    @staticmethod
    def extract_headings_from_html(raw_html):
        headings = re.findall(
            r"<h[1-6][^>]*>(.*?)</h[1-6]>",
            str(raw_html or ""),
            flags=re.IGNORECASE | re.DOTALL,
        )
        cleaned = []
        for heading in headings:
            without_tags = re.sub(r"<[^>]+>", " ", heading)
            normalized = re.sub(r"\s+", " ", unescape(without_tags)).strip()
            if normalized:
                cleaned.append(normalized)
        return " ".join(cleaned)[:4000]

    def save(self, *args, **kwargs):
        self.search_headings = self.extract_headings_from_html(self.content)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title

class Comment(models.Model):

    post = models.ForeignKey(
        Post,
        on_delete=models.CASCADE,
        related_name="comments"
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE
    )

    content = models.TextField()

    created_at = models.DateTimeField(
        auto_now_add=True
    )

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
