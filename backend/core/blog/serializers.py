from rest_framework import serializers
from cloudinary.utils import cloudinary_url
from .models import Category, Comment, ContactMessage, NewsletterSubscriber, Post


class CategorySerializer(serializers.ModelSerializer):

    class Meta:
        model = Category
        fields = "__all__"


class PostSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source="author.username", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    image_url = serializers.SerializerMethodField()
    reading_time_minutes = serializers.SerializerMethodField()

    def get_image_url(self, obj):
        if not obj.image:
            return None
        url, _ = cloudinary_url(obj.image.public_id, secure=True)
        return url

    def get_reading_time_minutes(self, obj):
        text_value = ""

        try:
            deferred_fields = obj.get_deferred_fields()
        except Exception:
            deferred_fields = set()

        if "content" not in deferred_fields and getattr(obj, "content", None):
            text_value = str(obj.content)
        elif getattr(obj, "excerpt", None):
            # Fallback estimation for list responses where content is intentionally deferred.
            text_value = f"{obj.excerpt} {obj.excerpt}"

        words = len(
            [word for word in str(text_value).strip().split() if word.strip()]
        )
        return max(1, (words + 199) // 200)

    def validate_faq_blocks(self, value):
        if value in (None, ""):
            return []

        if not isinstance(value, list):
            raise serializers.ValidationError("FAQ blocks must be an array.")

        if len(value) > 12:
            raise serializers.ValidationError("FAQ blocks cannot exceed 12 items.")

        normalized = []
        for index, item in enumerate(value):
            if not isinstance(item, dict):
                raise serializers.ValidationError(
                    f"FAQ item #{index + 1} must be an object with question and answer."
                )

            question = str(item.get("question", "")).strip()
            answer = str(item.get("answer", "")).strip()

            if not question:
                raise serializers.ValidationError(f"FAQ item #{index + 1} requires a question.")
            if not answer:
                raise serializers.ValidationError(f"FAQ item #{index + 1} requires an answer.")
            if len(question) > 220:
                raise serializers.ValidationError(
                    f"FAQ item #{index + 1} question must be 220 characters or fewer."
                )
            if len(answer) > 2000:
                raise serializers.ValidationError(
                    f"FAQ item #{index + 1} answer must be 2000 characters or fewer."
                )

            normalized.append({"question": question, "answer": answer})

        return normalized

    class Meta:
        model = Post
        fields = [
            "id",
            "title",
            "slug",
            "excerpt",
            "content",
            "faq_blocks",
            "category",
            "category_name",
            "author",
            "author_username",
            "image",
            "image_url",
            "created_at",
            "status",
            "views_count",
            "reading_time_minutes",
        ]
        read_only_fields = ["author", "created_at", "views_count", "reading_time_minutes"]


class PostListSerializer(PostSerializer):
    class Meta(PostSerializer.Meta):
        fields = [
            "id",
            "title",
            "slug",
            "excerpt",
            "category",
            "category_name",
            "author",
            "author_username",
            "image",
            "image_url",
            "created_at",
            "status",
            "views_count",
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
