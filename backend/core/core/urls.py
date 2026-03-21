
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from blog.api_views import categories
from .views import health, metrics, root

urlpatterns = [
    path('', root),
    path('favicon.ico', root),
    path('admin/', admin.site.urls),
    path("api/", include("blog.urls")),
    path("api/", include("accounts.urls")),
    path("api/login", TokenObtainPairView.as_view()),
    path("api/login/", TokenObtainPairView.as_view()),
    path("api/login/refresh", TokenRefreshView.as_view()),
    path("api/login/refresh/", TokenRefreshView.as_view()),
    path('api/categories/', categories),
    path("metrics/", metrics),
    path("api/metrics/", metrics),
    path("health/", health),
    path("api/health/", health),


]
