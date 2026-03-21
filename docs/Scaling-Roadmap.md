# Scaling Roadmap

## Current Baseline
- Stateless API architecture and token auth
- Query/index improvements for search and publish timelines
- Runtime metrics for latency/status/connection visibility
- Load test harness via Locust

## Phase 1 (Near-term)
- Move from in-process metrics to centralized metrics backend
- Add Redis cache backend for shared multi-instance caching
- Add read-replica strategy for heavy read/search endpoints
- Add explicit query budget checks in CI

## Phase 2 (Growth)
- Queue background jobs for heavy editorial tasks and analytics batching
- Expand search to dedicated full-text search service if required
- Add autoscaling policies tied to latency/error SLOs
- Implement ad delivery optimization guardrails for Core Web Vitals

## Phase 3 (Large-scale)
- Multi-region frontend CDN edge strategy
- Database partitioning/archival for analytics events
- Advanced observability with distributed tracing and alert routing
- Automated disaster-recovery drills and recovery-time measurement
