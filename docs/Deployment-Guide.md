# Deployment Guide

## Targets
- Frontend: Vercel (recommended)
- Backend: Container or VM runtime for Django API
- DB: Managed PostgreSQL (Neon-compatible)

## Environment Separation
- Keep distinct env sets for dev/staging/prod.
- Ensure frontend points to environment-specific API URL.
- Configure optional telemetry tokens and DSNs per environment.

## CI/CD
- GitHub Actions workflow in `.github/workflows/ci.yml` runs:
  - Backend tests
  - Frontend lint + build
  - Lighthouse CI on pull requests

## Backend Deploy Steps
1. Install dependencies from `requirements.txt`.
2. Set production env variables.
3. Run `python manage.py migrate --noinput`.
4. Start app with production WSGI server.

## Frontend Deploy Steps
1. Install dependencies in `frontend/my-app`.
2. Build with `npm run build`.
3. Start with `npm run start` or deploy to Vercel.

## Post-Deploy Verification
- `GET /api/health/` returns status ok.
- `GET /api/metrics/` returns runtime metrics (with token if configured).
- Publish and search smoke tests pass.
