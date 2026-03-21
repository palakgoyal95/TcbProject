# Security Hardening Checklist

## Application
- [ ] Set `DEBUG=False` in production
- [ ] Restrict `ALLOWED_HOSTS` to production domains
- [ ] Restrict CORS origins (avoid `CORS_ALLOW_ALL_ORIGINS=True` in production)
- [ ] Enforce strong JWT expiry and refresh controls

## Secrets
- [ ] Store env vars in secure secret manager
- [ ] Rotate Cloudinary/API keys on schedule
- [ ] Never commit secrets to repository history

## API Controls
- [x] Role-based publishing controls in editorial workflow
- [x] Permission check for autosave ownership
- [x] Metrics endpoint token gate available

## Infra
- [ ] Cloudflare WAF/DDoS/Bot rules verified
- [ ] TLS termination and secure headers validated
- [ ] Least-privilege database credentials enforced
