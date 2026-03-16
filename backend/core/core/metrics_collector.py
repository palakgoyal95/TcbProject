import threading
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone

from django.db import connections


_LOCK = threading.Lock()
_STARTED_AT = time.time()
_REQUESTS_TOTAL = 0
_ERRORS_TOTAL = 0
_LATENCY_TOTAL_MS = 0.0
_LATENCY_MAX_MS = 0.0
_STATUS_COUNTS = Counter()
_PATH_STATS = defaultdict(
    lambda: {
        "requests_total": 0,
        "errors_total": 0,
        "latency_total_ms": 0.0,
        "latency_max_ms": 0.0,
        "status_counts": Counter(),
    }
)
_PROCESS_STARTED_AT_ISO = datetime.now(timezone.utc).isoformat()


def _build_path_key(method, path):
    normalized_method = str(method or "GET").upper()
    normalized_path = str(path or "/")
    return f"{normalized_method} {normalized_path}"


def record_request(method, path, status_code, latency_ms):
    global _REQUESTS_TOTAL, _ERRORS_TOTAL, _LATENCY_TOTAL_MS, _LATENCY_MAX_MS

    safe_status_code = int(status_code or 500)
    safe_latency_ms = max(0.0, float(latency_ms or 0.0))
    path_key = _build_path_key(method, path)

    with _LOCK:
        _REQUESTS_TOTAL += 1
        _LATENCY_TOTAL_MS += safe_latency_ms
        _LATENCY_MAX_MS = max(_LATENCY_MAX_MS, safe_latency_ms)
        _STATUS_COUNTS[str(safe_status_code)] += 1

        path_bucket = _PATH_STATS[path_key]
        path_bucket["requests_total"] += 1
        path_bucket["latency_total_ms"] += safe_latency_ms
        path_bucket["latency_max_ms"] = max(path_bucket["latency_max_ms"], safe_latency_ms)
        path_bucket["status_counts"][str(safe_status_code)] += 1

        if safe_status_code >= 500:
            _ERRORS_TOTAL += 1
            path_bucket["errors_total"] += 1


def get_metrics_snapshot(top_paths=50):
    try:
        safe_top_paths = int(top_paths)
    except (TypeError, ValueError):
        safe_top_paths = 50
    safe_top_paths = min(max(1, safe_top_paths), 200)

    database_connections = []
    open_connection_count = 0
    for alias in connections:
        connection = connections[alias]
        has_open_connection = connection.connection is not None
        if has_open_connection:
            open_connection_count += 1

        is_usable = False
        if has_open_connection:
            try:
                is_usable = bool(connection.is_usable())
            except Exception:
                is_usable = False

        database_connections.append(
            {
                "alias": alias,
                "vendor": connection.vendor,
                "database_name": str(connection.settings_dict.get("NAME", "")),
                "has_open_connection": has_open_connection,
                "is_usable": is_usable,
                "in_atomic_block": bool(getattr(connection, "in_atomic_block", False)),
            }
        )

    with _LOCK:
        requests_total = _REQUESTS_TOTAL
        errors_total = _ERRORS_TOTAL
        avg_latency_ms = round((_LATENCY_TOTAL_MS / requests_total), 2) if requests_total else 0.0

        sorted_paths = sorted(
            _PATH_STATS.items(),
            key=lambda item: item[1]["requests_total"],
            reverse=True,
        )

        path_items = []
        for path_key, stats in sorted_paths[:safe_top_paths]:
            request_count = stats["requests_total"]
            path_items.append(
                {
                    "path": path_key,
                    "requests_total": request_count,
                    "errors_total": stats["errors_total"],
                    "error_rate_percent": round((stats["errors_total"] / request_count) * 100, 2)
                    if request_count
                    else 0.0,
                    "latency_avg_ms": round((stats["latency_total_ms"] / request_count), 2)
                    if request_count
                    else 0.0,
                    "latency_max_ms": round(stats["latency_max_ms"], 2),
                    "status_counts": dict(stats["status_counts"]),
                }
            )

        return {
            "process_started_at": _PROCESS_STARTED_AT_ISO,
            "uptime_seconds": round(max(0.0, time.time() - _STARTED_AT), 2),
            "cold_start_seconds": round(max(0.0, time.time() - _STARTED_AT), 2),
            "requests_total": requests_total,
            "errors_total": errors_total,
            "error_rate_percent": round((errors_total / requests_total) * 100, 2)
            if requests_total
            else 0.0,
            "latency_avg_ms": avg_latency_ms,
            "latency_max_ms": round(_LATENCY_MAX_MS, 2),
            "status_counts": dict(_STATUS_COUNTS),
            "database": {
                "open_connections": open_connection_count,
                "configured_connections": len(database_connections),
                "connections": database_connections,
            },
            "top_paths": path_items,
        }
