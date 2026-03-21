import os

from django.contrib.auth.models import User
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import WriterProfile


def _build_unique_username(base_username):
    cleaned = "".join(ch for ch in (base_username or "google_user") if ch.isalnum() or ch in "._-")
    cleaned = cleaned[:150] or "google_user"

    candidate = cleaned
    counter = 1
    while User.objects.filter(username=candidate).exists():
        suffix = f"_{counter}"
        candidate = f"{cleaned[:150 - len(suffix)]}{suffix}"
        counter += 1
    return candidate


def _build_editorial_capabilities(user):
    can_manage_all_posts = bool(user.is_staff or user.is_superuser)
    can_schedule_posts = bool(can_manage_all_posts or user.has_perm("blog.publish_post"))

    if user.is_superuser:
        role = "admin"
    elif can_manage_all_posts or can_schedule_posts:
        role = "editor"
    else:
        role = "writer"

    return role, {
        "can_publish_posts": True,
        "can_schedule_posts": can_schedule_posts,
        "can_manage_all_posts": can_manage_all_posts,
    }


@api_view(['POST'])
def register(request):

    username = request.data.get("username")
    password = request.data.get("password")

    user = User.objects.create_user(
        username=username,
        password=password
    )

    return Response({"message": "User created"})


@api_view(['POST'])
def google_auth(request):
    credential = request.data.get("credential")
    if not credential:
        return Response({"detail": "Missing Google credential token."}, status=status.HTTP_400_BAD_REQUEST)

    google_client_id = os.getenv("GOOGLE_CLIENT_ID")
    if not google_client_id:
        return Response({"detail": "Server is missing GOOGLE_CLIENT_ID configuration."}, status=500)

    try:
        payload = id_token.verify_oauth2_token(credential, google_requests.Request(), google_client_id)
    except ValueError:
        return Response({"detail": "Invalid Google token."}, status=status.HTTP_400_BAD_REQUEST)

    issuer = payload.get("iss")
    if issuer not in {"accounts.google.com", "https://accounts.google.com"}:
        return Response({"detail": "Invalid Google token issuer."}, status=status.HTTP_400_BAD_REQUEST)

    email = (payload.get("email") or "").strip().lower()
    if not email or not payload.get("email_verified", False):
        return Response(
            {"detail": "Google account must provide a verified email address."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = User.objects.filter(email__iexact=email).first()
    if user is None:
        username_seed = email.split("@")[0] or f"google_{payload.get('sub', 'user')}"
        user = User(
            username=_build_unique_username(username_seed),
            email=email,
            first_name=((payload.get("given_name") or payload.get("name") or "")[:150]),
        )
        user.set_unusable_password()
        user.save()

    refresh = RefreshToken.for_user(user)
    return Response(
        {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
            },
        }
    )


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def me(request):

    user = request.user
    profile, _ = WriterProfile.objects.get_or_create(user=user)
    role, capabilities = _build_editorial_capabilities(user)

    if request.method == "PATCH":
        username = request.data.get("username")
        about = request.data.get("about")

        validation_errors = {}

        if username is not None:
            username = str(username).strip()
            if not username:
                validation_errors["username"] = "Username cannot be empty."
            elif len(username) > 150:
                validation_errors["username"] = "Username must be 150 characters or fewer."
            elif User.objects.filter(username__iexact=username).exclude(id=user.id).exists():
                validation_errors["username"] = "This username is already taken."

        if about is not None:
            about = str(about).strip()
            if len(about) > 1000:
                validation_errors["about"] = "About writer must be 1000 characters or fewer."

        if validation_errors:
            return Response(validation_errors, status=status.HTTP_400_BAD_REQUEST)

        if username is not None:
            user.username = username
            user.save(update_fields=["username"])

        if about is not None:
            profile.about = about
            profile.save(update_fields=["about"])

    return Response({
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "about": profile.about,
        "role": role,
        "is_staff": bool(user.is_staff),
        "capabilities": capabilities,
    })
