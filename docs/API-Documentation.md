# API Documentation

## Auth
- `POST /api/register/`
- `POST /api/login/`
- `POST /api/login/refresh/`
- `GET /api/me/`

## Editorial and CMS
- `GET /api/posts/`
- `POST /api/posts/`
- `GET /api/posts/{slug}/`
- `PATCH /api/posts/{slug}/`
- `DELETE /api/posts/{slug}/`
- `PUT /api/editorial/autosave/`
- `GET /api/editorial/autosave/?draft_key={key}`

## Discovery and Search
- `GET /api/search/?q={query}`
- `POST /api/search/analytics/`
- `GET /api/posts/{id}/internal-suggestions/`
- `GET /api/posts/popular/?limit={n}`

## Engagement and Analytics
- `POST /api/posts/{slug}/track-view/`
- `POST /api/analytics/engagement/`

## Taxonomy and Content Support
- `GET /api/categories/`
- `GET /api/categories/{slug}/posts/`
- `GET /api/authors/{username}/posts/`
- `GET|POST /api/posts/{slug}/comments/`

## Platform Ops Endpoints
- `GET /api/metrics/`
- `GET /api/health/`

## Notes
- Authenticated write endpoints require JWT bearer token.
- Metrics endpoint can be protected with `METRICS_TOKEN`.
- Scheduled publishing requires editor/admin capability.
