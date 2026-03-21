# Database Schema Diagram

```mermaid
ERDiagram
  USER ||--o{ POST : authors
  CATEGORY ||--o{ POST : categorizes
  POST ||--o{ COMMENT : has
  USER ||--o{ COMMENT : writes
  POST ||--o{ POSTVIEW : tracks
  USER ||--o{ EDITORIALAUTOSAVE : owns
  POST ||--o{ EDITORIALAUTOSAVE : may_target
  POST ||--o{ ANALYTICSEVENT : generates
  USER ||--o{ ANALYTICSEVENT : may_trigger

  POST {
    int id
    string title
    string slug
    string status
    datetime scheduled_for
    datetime published_at
    json content_blocks
    json faq_blocks
    bool is_sponsored
    bool premium_enabled
    json ad_slots
  }

  ANALYTICSEVENT {
    int id
    string event_type
    int post_id
    int user_id
    string query
    int result_count
    int depth_percent
    json metadata
    datetime created_at
  }
```

## Index Highlights
- Publish and timeline indexes on post status/publication dates.
- Search vector GIN index for relevance ranking.
- Unique daily view constraint for deduplicated page views.
- Autosave uniqueness on (`author`, `draft_key`).
