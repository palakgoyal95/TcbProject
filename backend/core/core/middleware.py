import time

from .metrics_collector import record_request


class RequestMetricsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        started_at = time.perf_counter()

        try:
            response = self.get_response(request)
        except Exception:
            elapsed_ms = (time.perf_counter() - started_at) * 1000
            record_request(
                method=request.method,
                path=request.path,
                status_code=500,
                latency_ms=elapsed_ms,
            )
            raise

        elapsed_ms = (time.perf_counter() - started_at) * 1000
        record_request(
            method=request.method,
            path=request.path,
            status_code=getattr(response, "status_code", 500),
            latency_ms=elapsed_ms,
        )

        return response
