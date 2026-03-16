from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .metrics_collector import get_metrics_snapshot


def _extract_metrics_token(request):
    header_token = str(request.headers.get("X-Metrics-Token", "") or "").strip()
    if header_token:
        return header_token

    auth_header = str(request.headers.get("Authorization", "") or "").strip()
    if auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip()

    query_token = str(request.GET.get("token", "") or "").strip()
    return query_token


@api_view(["GET"])
@permission_classes([AllowAny])
def metrics(request):
    configured_token = str(getattr(settings, "METRICS_TOKEN", "") or "").strip()
    if configured_token:
        provided_token = _extract_metrics_token(request)
        if provided_token != configured_token:
            return Response(
                {"detail": "Invalid metrics token."},
                status=status.HTTP_403_FORBIDDEN,
            )

    top_paths = request.GET.get("top_paths", 50)
    metrics_payload = get_metrics_snapshot(top_paths=top_paths)

    return Response(
        {
            "status": "ok",
            "metrics": metrics_payload,
        }
    )
