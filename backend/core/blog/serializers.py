from cloudinary.utils import cloudinary_url
from django.utils import timezone
from rest_framework import serializers

from .editorial import (
    build_seo_preview,
    build_slug_preview,
    estimate_reading_time_minutes,
    estimate_word_count,
    extract_content_blocks_from_html,
    normalize_content_blocks,
    normalize_faq_blocks,
    render_content_blocks_to_html,
)
from .models import (
    Category,
    Comment,
    ContactMessage,
    EditorialAutosave,
    NewsletterSubscriber,
    Post,
)


class CategorySerializer(serializers.ModelSerializer):

    class Meta:
        model = Category
        fields = "__all__"


class PostSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source="author.username", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    image_url = serializers.SerializerMethodField()
    word_count = serializers.SerializerMethodField()
    reading_time_minutes = serializers.SerializerMethodField()
    slug_preview = serializers.SerializerMethodField()
    seo_preview = serializers.SerializerMethodField()
    effective_status = serializers.SerializerMethodField()
    is_live = serializers.SerializerMethodField()

    def get_image_url(self, obj):
        if not obj.image:
            return None
        url, _ = cloudinary_url(obj.image.public_id, secure=True)
        return url

    def get_reading_time_minutes(self, obj):
        content_value, faq_blocks = self._resolve_metric_inputs(obj)
        return estimate_reading_time_minutes(content=content_value, faq_blocks=faq_blocks)

    def get_word_count(self, obj):
        content_value, faq_blocks = self._resolve_metric_inputs(obj)
        return estimate_word_count(content=content_value, faq_blocks=faq_blocks)

    def get_slug_preview(self, obj):
        return build_slug_preview(obj.slug)

    def get_seo_preview(self, obj):
        return build_seo_preview(
            title=obj.title,
            seo_title=obj.seo_title,
            excerpt=obj.excerpt,
            seo_description=obj.seo_description,
            slug=obj.slug,
        )

    def get_effective_status(self, obj):
        if obj.status != Post.Status.PUBLISHED:
            return obj.status
        if obj.published_at and obj.published_at > timezone.now():
            return "SCHEDULED"
        return Post.Status.PUBLISHED

    def get_is_live(self, obj):
        return self.get_effective_status(obj) == Post.Status.PUBLISHED

    def _resolve_metric_inputs(self, obj):
        try:
            deferred_fields = obj.get_deferred_fields()
        except Exception:
            deferred_fields = set()

        if "content" not in deferred_fields and getattr(obj, "content", None):
            content_value = str(obj.content)
        else:
            content_value = str(getattr(obj, "excerpt", "") or "")

        faq_blocks = []
        if "faq_blocks" not in deferred_fields:
            faq_blocks = getattr(obj, "faq_blocks", []) or []

        return content_value, faq_blocks

    def validate_faq_blocks(self, value):
        try:
            return normalize_faq_blocks(value)
        except ValueError as error:
            raise serializers.ValidationError(str(error)) from error

    def validate_content_blocks(self, value):
        try:
            return normalize_content_blocks(value)
        except ValueError as error:
            raise serializers.ValidationError(str(error)) from error

    def validate_ad_slots(self, value):
        if value in (None, ""):
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Ad slots must be an object.")

        allowed_slots = {"top", "inline", "sidebar"}
        normalized = {}
        for key, slot_value in value.items():
            if key not in allowed_slots:
                raise serializers.ValidationError(f"Unsupported ad slot '{key}'.")
            if isinstance(slot_value, dict):
                normalized[key] = slot_value
            else:
                normalized[key] = {"enabled": bool(slot_value)}
        return normalized

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        title = str(attrs.get("title", getattr(instance, "title", "")) or "").strip()
        excerpt = str(attrs.get("excerpt", getattr(instance, "excerpt", "")) or "").strip()
        faq_blocks = attrs.get(
            "faq_blocks",
            getattr(instance, "faq_blocks", []),
        )
        content_blocks = attrs.get(
            "content_blocks",
            getattr(instance, "content_blocks", []),
        )
        content = str(attrs.get("content", getattr(instance, "content", "")) or "")

        if not content.strip() and not content_blocks:
            raise serializers.ValidationError(
                {"content": "Content or content_blocks is required."}
            )

        if content_blocks and not content.strip():
            attrs["content"] = render_content_blocks_to_html(content_blocks)
        elif content.strip() and not content_blocks:
            attrs["content_blocks"] = extract_content_blocks_from_html(
                content,
                faq_blocks=faq_blocks,
            )

        attrs["seo_title"] = str(
            attrs.get("seo_title", getattr(instance, "seo_title", "") or title)
        ).strip()[:70]
        attrs["seo_description"] = str(
            attrs.get("seo_description", getattr(instance, "seo_description", "") or excerpt)
        ).strip()[:170]

        return attrs

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "slug",
            "slug_preview",
            "excerpt",
            "content",
            "content_blocks",
            "faq_blocks",
            "seo_title",
            "seo_description",
            "canonical_url",
            "seo_noindex",
            "seo_preview",
            "category",
            "category_name",
            "author",
            "author_username",
            "image",
            "image_url",
            "created_at",
            "published_at",
            "scheduled_for",
            "last_edited_at",
            "status",
            "effective_status",
            "is_live",
            "is_sponsored",
            "disclosure_text",
            "premium_enabled",
            "ad_slots",
            "views_count",
            "word_count",
            "reading_time_minutes",
        ]
        read_only_fields = [
            "author",
            "created_at",
            "published_at",
            "last_edited_at",
            "views_count",
            "word_count",
            "reading_time_minutes",
            "slug_preview",
            "seo_preview",
            "effective_status",
            "is_live",
        ]
        extra_kwargs = {
            "content": {"required": False, "allow_blank": True},
            "content_blocks": {"required": False},
            "faq_blocks": {"required": False},
            "scheduled_for": {"required": False, "allow_null": True},
            "seo_title": {"required": False, "allow_blank": True},
            "seo_description": {"required": False, "allow_blank": True},
            "canonical_url": {"required": False, "allow_blank": True},
            "disclosure_text": {"required": False, "allow_blank": True},
            "ad_slots": {"required": False},
        }


class PostListSerializer(PostSerializer):
    class Meta(PostSerializer.Meta):
        fields = [
            "id",
            "title",
            "slug",
            "slug_preview",
            "excerpt",
            "category",
            "category_name",
            "author",
            "author_username",
            "image",
            "image_url",
            "created_at",
            "published_at",
            "status",
            "effective_status",
            "is_live",
            "views_count",
            "word_count",
            "reading_time_minutes",
        ]


class CommentSerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Comment
        fields = ["id", "post", "user", "user_username", "content", "created_at"]
        read_only_fields = ["id", "post", "user", "user_username", "created_at"]

    def validate_content(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Comment cannot be empty.")
        return cleaned


class NewsletterSubscriberSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsletterSubscriber
        fields = ["id", "email", "is_active", "subscribed_at"]
        read_only_fields = ["id", "is_active", "subscribed_at"]
        extra_kwargs = {"email": {"validators": []}}

    def validate_email(self, value):
        return value.strip().lower()


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ["id", "name", "email", "subject", "message", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]

    def validate_name(self, value):
        return value.strip()

    def validate_subject(self, value):
        return value.strip()

    def validate_message(self, value):
        return value.strip()


class EditorialAutosaveSerializer(serializers.ModelSerializer):
    post_slug = serializers.CharField(source="post.slug", read_only=True)

    class Meta:
        model = EditorialAutosave
        fields = [
            "id",
            "draft_key",
            "post",
            "post_slug",
            "payload",
            "word_count",
            "updated_at",
            "created_at",
        ]
        read_only_fields = ["id", "word_count", "updated_at", "created_at", "post_slug"]

    def validate_draft_key(self, value):
        normalized = str(value or "").strip() or "new-post"
        return normalized[:80]

    def validate_payload(self, value):
        if value in (None, ""):
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Autosave payload must be an object.")

        normalized = dict(value)
        if "faqBlocks" in normalized:
            try:
                normalized["faqBlocks"] = normalize_faq_blocks(normalized["faqBlocks"])
            except ValueError as error:
                raise serializers.ValidationError(str(error)) from error

        if "contentBlocks" in normalized:
            try:
                normalized["contentBlocks"] = normalize_content_blocks(normalized["contentBlocks"])
            except ValueError as error:
                raise serializers.ValidationError(str(error)) from error

        content_value = str(normalized.get("editorHtml", normalized.get("content", "")) or "")
        faq_blocks = normalized.get("faqBlocks", [])

        if normalized.get("contentBlocks") and not content_value.strip():
            normalized["editorHtml"] = render_content_blocks_to_html(normalized["contentBlocks"])
        elif content_value.strip() and not normalized.get("contentBlocks"):
            normalized["contentBlocks"] = extract_content_blocks_from_html(
                content_value,
                faq_blocks=faq_blocks,
            )

        return normalized

    def create(self, validated_data):
        validated_data["word_count"] = estimate_word_count(
            content=validated_data.get("payload", {}).get("editorHtml", ""),
            faq_blocks=validated_data.get("payload", {}).get("faqBlocks", []),
        )
        return super().create(validated_data)

    def update(self, instance, validated_data):
        payload = validated_data.get("payload", instance.payload)
        validated_data["word_count"] = estimate_word_count(
            content=payload.get("editorHtml", ""),
            faq_blocks=payload.get("faqBlocks", []),
        )
        return super().update(instance, validated_data)
