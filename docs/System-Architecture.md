# System Architecture Document

## Overview
- Frontend: Next.js app in `frontend/my-app`
- Backend: Django + DRF in `backend/core`
- Data: PostgreSQL-compatible schema (with SQLite fallback for tests)
- Media: Cloudinary
- Auth: JWT via SimpleJWT + optional Google auth flow

## Runtime Topology
- Client requests land on Next.js routes.
- Next.js calls Django API endpoints under `/api/*`.
- Django serves editorial workflows, search, analytics event ingestion, and metrics APIs.
- Database stores posts, autosaves, comments, views, and analytics events.

## Editorial Pipeline
- Draft and publish lifecycle: `DRAFT` -> `PUBLISHED` or `SCHEDULED`.
- Scheduling is role-gated (`blog.publish_post` permission).
- Autosave persistence stored per user and `draft_key`.
- Content can be authored in HTML or normalized `content_blocks`.

## Search and Discovery
- Full-text support via PostgreSQL search vectors and GIN index.
- Related/internal suggestion engine combines category and keyword overlap.
- Popular posts endpoint based on tracked unique views.

## Observability
- Request metrics middleware captures latency, status, and error counts.
- Metrics endpoint: `/api/metrics/`.
- Health endpoint: `/api/health/`.
- Structured JSON logging configured in Django settings.
- Optional Sentry capture enabled when `SENTRY_DSN` is configured.

## Scalability Design
- Stateless API workers (session-free API auth model).
- Caching helper abstraction (`cache_utils`) for hot endpoints.
- DB index strategy for publish/search/query paths.
- Frontend supports CDN-first delivery and ISR patterns.
