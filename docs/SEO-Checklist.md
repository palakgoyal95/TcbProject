# SEO Checklist

## Metadata
- [x] Slug preview available in CMS responses
- [x] SEO preview payload generated from title/description/excerpt
- [x] Search page metadata includes robots directives
- [x] Search Console verification hook in app metadata (`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`)

## Content Structure
- [x] Heading hierarchy supported in block model (H1-H6)
- [x] FAQ blocks normalized for structured content
- [x] Internal link suggestion API for editorial linking

## Performance and Crawlability
- [x] Lightweight post list serializer for archive/list pages
- [x] Related posts suggestions for discovery depth
- [x] Lighthouse CI configured for PR quality gates

## Editorial Practice
- [ ] Ensure canonical URLs are populated for all production posts
- [ ] Ensure `seo_noindex` is applied to non-indexable pages where needed
- [ ] Keep title and description lengths inside SERP guidance limits
