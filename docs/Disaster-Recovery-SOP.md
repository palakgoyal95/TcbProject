# Disaster Recovery SOP

## Incident Triggers
- Production outage
- Data corruption or accidental destructive write
- Security breach requiring rollback

## Immediate Actions
1. Freeze deploys.
2. Declare incident owner and communication channel.
3. Confirm service health via `/api/health/` and logs.

## Recovery Procedure
1. Identify blast radius (frontend, API, DB, third-party services).
2. If DB issue: restore from latest verified backup or point-in-time snapshot.
3. Redeploy last known-good application revision.
4. Run migration state verification and smoke tests.

## Validation
- Validate publish/search/auth/autosave paths.
- Validate analytics and monitoring signals recover.

## Post-Incident
- Publish RCA within 48 hours.
- Add prevention actions and owners.
- Update this SOP with lessons learned.
