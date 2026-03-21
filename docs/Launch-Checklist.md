# Launch Checklist

## Environment
- [ ] Production backend env vars configured
- [ ] Production frontend env vars configured
- [ ] `SENTRY_DSN` and env name set
- [ ] `METRICS_TOKEN` set for protected metrics access

## Database
- [ ] Run migrations on production
- [ ] Validate scheduled publication behavior
- [ ] Confirm indexes are present in production DB

## Observability
- [ ] Verify `/api/health/` checks in uptime monitor
- [ ] Verify `/api/metrics/` in monitoring dashboard
- [ ] Confirm structured logs are visible in log sink

## Frontend
- [ ] Validate GA4 events in debug view
- [ ] Validate Cloudflare beacon ingestion
- [ ] Confirm Search Console verification tag appears

## Readiness
- [ ] Smoke test publish + autosave + search flows
- [ ] Confirm rollback snapshot/backup policy
- [ ] Approve launch by engineering + editorial leads
