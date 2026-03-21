from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .api_views import (
    author_posts,
    category_posts,
    contact,
    editorial_autosave,
    engagement_analytics,
    internal_suggestions,
    popular_posts,
    post_comments,
    PostViewSet,
    search_analytics,
    search_posts,
    subscribe,
    track_post_view,
    upload_image,
)

router = DefaultRouter()
router.register("posts", PostViewSet, basename="post")

urlpatterns = [
    path("posts/popular/", popular_posts),
    path("posts/popular", popular_posts),
    path("posts/<slug:slug>/track-view", track_post_view),
    path("posts/<slug:slug>/track-view/", track_post_view),
    path("editorial/autosave", editorial_autosave),
    path("editorial/autosave/", editorial_autosave),
    path("analytics/engagement", engagement_analytics),
    path("analytics/engagement/", engagement_analytics),
    path("search/analytics", search_analytics),
    path("search/analytics/", search_analytics),
    path("", include(router.urls)),
    path(
        "categories/<slug:slug>/posts/",
        category_posts,
    ),
    path(
        "authors/<str:username>/posts/",
        author_posts,
    ),
    path(
        "search/",
        search_posts,
    ),
    path("search", search_posts),
    path("posts/<int:post_id>/internal-suggestions", internal_suggestions),
    path("posts/<int:post_id>/internal-suggestions/", internal_suggestions),
    path("posts/<slug:slug>/comments", post_comments),
    path("posts/<slug:slug>/comments/", post_comments),
    path("uploads/images", upload_image),
    path("uploads/images/", upload_image),
    path("subscriptions", subscribe),
    path("subscriptions/", subscribe),
    path("contact", contact),
    path("contact/", contact),
]
