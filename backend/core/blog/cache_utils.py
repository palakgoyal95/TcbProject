import hashlib
import json

from django.core.cache import cache


def _cache_hash(payload):
    serialized = json.dumps(payload or {}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:20]


def build_cache_key(namespace, cache_args):
    return f"blog:{namespace}:{_cache_hash(cache_args)}"


def get_or_set_json(*, namespace, cache_args, ttl_seconds, producer):
    cache_key = build_cache_key(namespace, cache_args)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached, True

    fresh_value = producer()
    cache.set(cache_key, fresh_value, ttl_seconds)
    return fresh_value, False
