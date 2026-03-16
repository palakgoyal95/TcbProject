from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    author_posts,
    category_posts,
    contact,
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
    path("posts/<slug:slug>/track-view/", track_post_view),
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
    path("posts/<int:post_id>/internal-suggestions/", internal_suggestions),
    path("posts/<slug:slug>/comments/", post_comments),
    path("uploads/images/", upload_image),
    path("subscriptions/", subscribe),
    path("contact/", contact),
]
