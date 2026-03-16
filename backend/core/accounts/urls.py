from django.urls import path
from .views import google_auth, me, register

urlpatterns = [
    path("register/", register),
    path("auth/google/", google_auth),
    path("me/", me),
]
