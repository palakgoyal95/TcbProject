from django.contrib import admin
from .models import (
    AnalyticsEvent,
    Category,
    Comment,
    ContactMessage,
    EditorialAutosave,
    NewsletterSubscriber,
    Post,
)

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug")
    search_fields = ("name", "slug")


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "author",
        "category",
        "status",
        "published_at",
        "scheduled_for",
        "created_at",
    )
    list_filter = ("status", "category", "is_sponsored", "premium_enabled", "created_at")
    search_fields = ("title", "slug", "excerpt", "content", "seo_title", "seo_description")
    prepopulated_fields = {"slug": ("title",)}


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("id", "post", "user", "created_at")
    search_fields = ("post__title", "user__username", "content")


@admin.register(NewsletterSubscriber)
class NewsletterSubscriberAdmin(admin.ModelAdmin):
    list_display = ("id", "email", "is_active", "subscribed_at")
    list_filter = ("is_active", "subscribed_at")
    search_fields = ("email",)


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "email", "subject", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("name", "email", "subject", "message")


@admin.register(EditorialAutosave)
class EditorialAutosaveAdmin(admin.ModelAdmin):
    list_display = ("id", "draft_key", "author", "post", "word_count", "updated_at")
    list_filter = ("updated_at",)
    search_fields = ("draft_key", "author__username", "post__title")


@admin.register(AnalyticsEvent)
class AnalyticsEventAdmin(admin.ModelAdmin):
    list_display = ("id", "event_type", "post", "user", "source", "result_count", "depth_percent", "created_at")
    list_filter = ("event_type", "source", "created_at")
    search_fields = ("query", "source", "post__title", "user__username")
