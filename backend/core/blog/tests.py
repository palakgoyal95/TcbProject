from datetime import timedelta

from django.contrib.auth.models import User
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import (
    AnalyticsEvent,
    Category,
    Comment,
    ContactMessage,
    EditorialAutosave,
    NewsletterSubscriber,
    Post,
    PostView,
)


class SubscriptionApiTests(APITestCase):
    def test_can_subscribe_with_email(self):
        response = self.client.post("/api/subscriptions/", {"email": "reader@example.com"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(NewsletterSubscriber.objects.count(), 1)
        self.assertEqual(NewsletterSubscriber.objects.first().email, "reader@example.com")

    def test_duplicate_subscribe_returns_already_subscribed(self):
        NewsletterSubscriber.objects.create(email="reader@example.com")

        response = self.client.post("/api/subscriptions/", {"email": "reader@example.com"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get("status"), "already_subscribed")
        self.assertEqual(NewsletterSubscriber.objects.count(), 1)


class ContactApiTests(APITestCase):
    def test_contact_form_creates_message(self):
        payload = {
            "name": "Alex Reader",
            "email": "alex@example.com",
            "subject": "Partnership inquiry",
            "message": "Interested in content syndication.",
        }

        response = self.client.post("/api/contact/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(ContactMessage.objects.count(), 1)
        self.assertEqual(ContactMessage.objects.first().subject, "Partnership inquiry")


class PostCommentsApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="writer1", password="strong-pass-123")
        self.category = Category.objects.create(name="Technology", slug="technology")
        self.post = Post.objects.create(
            title="Team Architecture Playbook",
            slug="team-architecture-playbook",
            excerpt="How teams align around architecture.",
            content="Long form content for architecture decisions.",
            category=self.category,
            author=self.user,
            image="https://example.com/cover.jpg",
            status="PUBLISHED",
        )

    def test_list_comments_returns_created_comment(self):
        Comment.objects.create(post=self.post, user=self.user, content="Solid perspective.")

        response = self.client.get(f"/api/posts/{self.post.slug}/comments/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["user_username"], "writer1")

    def test_authenticated_user_can_create_comment(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            f"/api/posts/{self.post.slug}/comments/",
            {"content": "Great article, very practical."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Comment.objects.count(), 1)
        self.assertEqual(Comment.objects.first().content, "Great article, very practical.")

    def test_unauthenticated_user_cannot_create_comment(self):
        response = self.client.post(
            f"/api/posts/{self.post.slug}/comments/",
            {"content": "I should not be allowed."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(Comment.objects.count(), 0)


class InternalSuggestionsApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="writer2", password="strong-pass-123")
        self.product_category = Category.objects.create(name="Product", slug="product")
        self.ops_category = Category.objects.create(name="Operations", slug="operations")

        self.source_post = Post.objects.create(
            title="Product Metrics Framework For B2B Teams",
            slug="product-metrics-framework-for-b2b-teams",
            excerpt="A practical playbook for measuring product health and adoption.",
            content="This article explains KPI ladders, activation metrics, and retention loops.",
            category=self.product_category,
            author=self.user,
            image="https://example.com/source.jpg",
            status="PUBLISHED",
        )

        self.related_same_category = Post.objects.create(
            title="How Product Teams Improve Retention Metrics",
            slug="how-product-teams-improve-retention-metrics",
            excerpt="Retention strategy and metric reviews for product leaders.",
            content="Improve weekly active users, reduce churn, and align leadership reports.",
            category=self.product_category,
            author=self.user,
            image="https://example.com/related-1.jpg",
            status="PUBLISHED",
        )

        self.related_keyword_match = Post.objects.create(
            title="Retention Dashboards For Leadership Reviews",
            slug="retention-dashboards-for-leadership-reviews",
            excerpt="Build dashboards that surface product KPI movement quickly.",
            content="A metrics-focused dashboard workflow for executives and PMs.",
            category=self.ops_category,
            author=self.user,
            image="https://example.com/related-2.jpg",
            status="PUBLISHED",
        )

        Post.objects.create(
            title="Draft Post Should Not Appear",
            slug="draft-post-should-not-appear",
            excerpt="Draft content",
            content="Draft only",
            category=self.product_category,
            author=self.user,
            image="https://example.com/draft.jpg",
            status="DRAFT",
        )

    def test_internal_suggestions_returns_ranked_candidates(self):
        response = self.client.get(
            f"/api/posts/{self.source_post.id}/internal-suggestions/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["post_id"], self.source_post.id)
        self.assertIn("meta", response.data)
        self.assertIn("suggestions", response.data)
        self.assertGreaterEqual(len(response.data["suggestions"]), 1)

        first_item = response.data["suggestions"][0]
        self.assertIn(first_item["id"], {self.related_same_category.id, self.related_keyword_match.id})
        self.assertNotEqual(first_item["id"], self.source_post.id)
        self.assertTrue(first_item["anchor_suggestions"])
        self.assertGreater(first_item["score"], 0)

    def test_internal_suggestions_excludes_source_and_drafts(self):
        response = self.client.get(
            f"/api/posts/{self.source_post.id}/internal-suggestions/"
        )

        suggestion_ids = [item["id"] for item in response.data["suggestions"]]
        self.assertNotIn(self.source_post.id, suggestion_ids)
        self.assertNotIn(
            Post.objects.get(slug="draft-post-should-not-appear").id, suggestion_ids
        )


class PopularPostsAndViewTrackingApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="writer3", password="strong-pass-123")
        self.category = Category.objects.create(name="Growth", slug="growth")

        self.first_post = Post.objects.create(
            title="Growth loops for product teams",
            slug="growth-loops-for-product-teams",
            excerpt="Growth execution at a systems level.",
            content="Long form growth execution article.",
            category=self.category,
            author=self.user,
            image="https://example.com/growth.jpg",
            status="PUBLISHED",
        )
        self.second_post = Post.objects.create(
            title="Pricing experiments that improve expansion revenue",
            slug="pricing-experiments-expansion-revenue",
            excerpt="A practical pricing playbook.",
            content="How to run pricing tests with guardrails.",
            category=self.category,
            author=self.user,
            image="https://example.com/pricing.jpg",
            status="PUBLISHED",
        )
        self.draft_post = Post.objects.create(
            title="Draft hidden from popular feed",
            slug="draft-hidden-from-popular-feed",
            excerpt="Draft",
            content="Draft",
            category=self.category,
            author=self.user,
            image="https://example.com/draft-popular.jpg",
            status="DRAFT",
        )

    def test_track_view_counts_once_per_ip_and_user_agent_per_day(self):
        response_one = self.client.post(
            f"/api/posts/{self.first_post.slug}/track-view/",
            {},
            format="json",
            REMOTE_ADDR="10.0.0.1",
            HTTP_USER_AGENT="Mozilla/TestAgent",
        )
        response_two = self.client.post(
            f"/api/posts/{self.first_post.slug}/track-view/",
            {},
            format="json",
            REMOTE_ADDR="10.0.0.1",
            HTTP_USER_AGENT="Mozilla/TestAgent",
        )

        self.first_post.refresh_from_db()

        self.assertEqual(response_one.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response_two.status_code, status.HTTP_200_OK)
        self.assertEqual(response_one.data["status"], "counted")
        self.assertEqual(response_two.data["status"], "already_counted")
        self.assertEqual(self.first_post.views_count, 1)
        self.assertEqual(PostView.objects.filter(post=self.first_post).count(), 1)

    def test_track_view_counts_for_different_user_agent(self):
        self.client.post(
            f"/api/posts/{self.first_post.slug}/track-view/",
            {},
            format="json",
            REMOTE_ADDR="10.0.0.1",
            HTTP_USER_AGENT="Mozilla/AgentOne",
        )
        self.client.post(
            f"/api/posts/{self.first_post.slug}/track-view/",
            {},
            format="json",
            REMOTE_ADDR="10.0.0.1",
            HTTP_USER_AGENT="Mozilla/AgentTwo",
        )

        self.first_post.refresh_from_db()

        self.assertEqual(self.first_post.views_count, 2)
        self.assertEqual(PostView.objects.filter(post=self.first_post).count(), 2)

    def test_popular_posts_orders_by_views_count_and_hides_drafts(self):
        self.first_post.views_count = 10
        self.first_post.save(update_fields=["views_count"])
        self.second_post.views_count = 4
        self.second_post.save(update_fields=["views_count"])
        self.draft_post.views_count = 99
        self.draft_post.save(update_fields=["views_count"])

        response = self.client.get("/api/posts/popular/?limit=5")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        titles = [item["title"] for item in response.data["results"]]
        self.assertEqual(
            titles[:2],
            [self.first_post.title, self.second_post.title],
        )
        self.assertNotIn(self.draft_post.title, titles)


class SearchApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="writer4", password="strong-pass-123")
        self.category = Category.objects.create(name="Strategy", slug="strategy")
        self.other_category = Category.objects.create(name="Finance", slug="finance")

        self.first_post = Post.objects.create(
            title="Retention strategy for B2B products",
            slug="retention-strategy-for-b2b-products",
            excerpt="Retention systems for product teams.",
            content="<h2>Retention loops</h2><p>Build sustainable loops with clear KPI ownership.</p>",
            category=self.category,
            author=self.user,
            image="https://example.com/retention.jpg",
            status="PUBLISHED",
        )
        self.second_post = Post.objects.create(
            title="Budget operating model for finance teams",
            slug="budget-operating-model-finance-teams",
            excerpt="Finance governance and controls.",
            content="<h2>Forecast quality</h2><p>How to keep forecasts reliable.</p>",
            category=self.other_category,
            author=self.user,
            image="https://example.com/finance.jpg",
            status="PUBLISHED",
        )

        self.third_post = Post.objects.create(
            title="Roadmap planning and retention experiments",
            slug="roadmap-planning-retention-experiments",
            excerpt="Planning experiments with customer cohorts.",
            content="<h3>Experiment cadence</h3><p>Weekly retention checks for PM teams.</p>",
            category=self.category,
            author=self.user,
            image="https://example.com/roadmap.jpg",
            status="PUBLISHED",
        )

    def test_search_returns_paginated_results(self):
        response = self.client.get("/api/search/?q=retention&page=1&page_size=1&sort=relevance")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("results", response.data)
        self.assertIn("pagination", response.data)
        self.assertEqual(response.data["pagination"]["page_size"], 1)
        self.assertGreaterEqual(response.data["pagination"]["total_count"], 1)

    def test_search_can_filter_by_category_and_sort_by_date(self):
        response = self.client.get(
            f"/api/search/?q=retention&category={self.category.id}&sort=date_desc&page=1&page_size=10"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result_slugs = [item["slug"] for item in response.data["results"]]
        self.assertIn(self.first_post.slug, result_slugs)
        self.assertIn(self.third_post.slug, result_slugs)
        self.assertNotIn(self.second_post.slug, result_slugs)

    def test_search_analytics_endpoint_accepts_valid_event(self):
        response = self.client.post(
            "/api/search/analytics/",
            {
                "event_type": "search_impression",
                "query": "retention",
                "result_count": 2,
                "source": "search-page",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data["status"], "recorded")


class MetricsApiTests(APITestCase):
    def test_metrics_endpoint_returns_runtime_snapshot(self):
        self.client.get("/api/categories/")

        response = self.client.get("/api/metrics/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get("status"), "ok")
        self.assertIn("metrics", response.data)
        self.assertIn("requests_total", response.data["metrics"])
        self.assertIn("top_paths", response.data["metrics"])
        self.assertIn("database", response.data["metrics"])
        self.assertIn("open_connections", response.data["metrics"]["database"])
        self.assertIn("cold_start_seconds", response.data["metrics"])
        self.assertGreaterEqual(response.data["metrics"]["requests_total"], 1)

    @override_settings(METRICS_TOKEN="test-metrics-token")
    def test_metrics_endpoint_requires_valid_token_when_configured(self):
        denied = self.client.get("/api/metrics/")
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        allowed = self.client.get(
            "/api/metrics/",
            HTTP_X_METRICS_TOKEN="test-metrics-token",
        )
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)


class FaqBlocksApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="writer5", password="strong-pass-123")
        self.category = Category.objects.create(name="Editorial", slug="editorial")
        self.client.force_authenticate(self.user)

    def test_create_post_persists_valid_faq_blocks(self):
        payload = {
            "title": "Editorial FAQ rollout",
            "slug": "editorial-faq-rollout",
            "excerpt": "How we structure FAQ content for discoverability.",
            "content": "<h2>FAQ strategy</h2><p>Structured data and intent mapping.</p>",
            "category": self.category.id,
            "image": "tcb-post-covers/editorial-faq-rollout",
            "status": "PUBLISHED",
            "faq_blocks": [
                {
                    "question": "What makes a good FAQ question?",
                    "answer": "Use direct language that mirrors actual reader search intent.",
                },
                {
                    "question": "How many FAQ entries should I include?",
                    "answer": "Include only high-signal questions that genuinely add clarity.",
                },
            ],
        }

        response = self.client.post("/api/posts/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data.get("faq_blocks", [])), 2)
        created_post = Post.objects.get(slug="editorial-faq-rollout")
        self.assertEqual(len(created_post.faq_blocks), 2)
        self.assertEqual(
            created_post.faq_blocks[0]["question"],
            "What makes a good FAQ question?",
        )

    def test_create_post_rejects_invalid_faq_block_shape(self):
        payload = {
            "title": "Invalid FAQ shape",
            "slug": "invalid-faq-shape",
            "excerpt": "Validation test for FAQ schema",
            "content": "<p>Validation content.</p>",
            "category": self.category.id,
            "image": "tcb-post-covers/invalid-faq-shape",
            "status": "DRAFT",
            "faq_blocks": [
                {
                    "question": "Question without answer",
                    "answer": "",
                }
            ],
        }

        response = self.client.post("/api/posts/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("faq_blocks", response.data)


class PostListPerformanceApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="writer6", password="strong-pass-123")
        self.category = Category.objects.create(name="Engineering", slug="engineering")

        self.post = Post.objects.create(
            title="Performance tuning playbook for content APIs",
            slug="performance-tuning-playbook-content-apis",
            excerpt="Practical steps for reducing query overhead and payload size.",
            content="<h2>Performance</h2><p>Long content body for testing list payload behavior.</p>",
            category=self.category,
            author=self.user,
            image="https://example.com/performance.jpg",
            status="PUBLISHED",
        )

    def test_posts_list_returns_lightweight_payload(self):
        response = self.client.get("/api/posts/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data)
        first_item = response.data[0]
        self.assertNotIn("content", first_item)
        self.assertNotIn("faq_blocks", first_item)
        self.assertIn("reading_time_minutes", first_item)

    def test_author_posts_returns_lightweight_payload(self):
        response = self.client.get(f"/api/authors/{self.user.username}/posts/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertNotIn("content", response.data[0])
        self.assertIn("reading_time_minutes", response.data[0])


class EditorialWorkflowApiTests(APITestCase):
    def setUp(self):
        self.writer = User.objects.create_user(username="writer7", password="strong-pass-123")
        self.editor = User.objects.create_user(
            username="editor1",
            password="strong-pass-123",
            is_staff=True,
        )
        self.category = Category.objects.create(name="Operations", slug="operations")

    def test_staff_can_schedule_post_and_public_endpoints_hide_it(self):
        self.client.force_authenticate(self.editor)
        scheduled_for = timezone.now() + timedelta(days=2)

        response = self.client.post(
            "/api/posts/",
            {
                "title": "Quarterly planning calendar",
                "slug": "quarterly-planning-calendar",
                "excerpt": "A future-dated editorial planning post.",
                "content": "<h2>Planning cadence</h2><p>Future launch details.</p>",
                "category": self.category.id,
                "image": "tcb-post-covers/quarterly-planning-calendar",
                "status": "PUBLISHED",
                "scheduled_for": scheduled_for.isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["effective_status"], "SCHEDULED")

        self.client.force_authenticate(user=None)
        list_response = self.client.get("/api/posts/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertNotIn("quarterly-planning-calendar", [item["slug"] for item in list_response.data])

        detail_response = self.client.get("/api/posts/quarterly-planning-calendar/")
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)

        self.client.force_authenticate(self.editor)
        editor_detail = self.client.get("/api/posts/quarterly-planning-calendar/")
        self.assertEqual(editor_detail.status_code, status.HTTP_200_OK)

    def test_non_editor_cannot_schedule_future_publication(self):
        self.client.force_authenticate(self.writer)
        scheduled_for = timezone.now() + timedelta(days=1)

        response = self.client.post(
            "/api/posts/",
            {
                "title": "Writer scheduled launch",
                "slug": "writer-scheduled-launch",
                "excerpt": "Scheduling should be restricted.",
                "content": "<h2>Schedule</h2><p>Restricted workflow.</p>",
                "category": self.category.id,
                "image": "tcb-post-covers/writer-scheduled-launch",
                "status": "PUBLISHED",
                "scheduled_for": scheduled_for.isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_post_from_content_blocks_generates_html_and_previews(self):
        self.client.force_authenticate(self.writer)

        response = self.client.post(
            "/api/posts/",
            {
                "title": "Block based planning guide",
                "slug": "block-based-planning-guide",
                "excerpt": "Create a post entirely from structured content blocks.",
                "content_blocks": [
                    {"type": "heading", "level": 2, "text": "Planning frame"},
                    {
                        "type": "list",
                        "style": "unordered",
                        "items": ["Collect inputs", "Draft sequence", "Review timing"],
                    },
                    {
                        "type": "highlight",
                        "text": "Use one calendar owner to reduce cross-team drift.",
                    },
                ],
                "category": self.category.id,
                "image": "tcb-post-covers/block-based-planning-guide",
                "status": "DRAFT",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertIn("<h2>", response.data["content"])
        self.assertEqual(response.data["slug_preview"], "http://localhost:3000/blog/block-based-planning-guide/")
        self.assertEqual(response.data["seo_preview"]["title"], "Block based planning guide")


class EditorialAutosaveApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="writer8", password="strong-pass-123")
        self.client.force_authenticate(self.user)

    def test_editorial_autosave_round_trip(self):
        payload = {
            "draft_key": "writer-studio",
            "payload": {
                "title": "Recovered draft",
                "editorHtml": "<h2>Recovery path</h2><p>Autosave keeps this work alive.</p>",
                "faqBlocks": [
                    {
                        "question": "Does autosave persist remotely?",
                        "answer": "Yes, this draft is stored on the backend.",
                    }
                ],
            },
        }

        save_response = self.client.put("/api/editorial/autosave/", payload, format="json")

        self.assertEqual(save_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(EditorialAutosave.objects.count(), 1)
        self.assertGreater(EditorialAutosave.objects.first().word_count, 0)

        fetch_response = self.client.get("/api/editorial/autosave/?draft_key=writer-studio")
        self.assertEqual(fetch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(fetch_response.data["payload"]["title"], "Recovered draft")


class AnalyticsEventApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="writer9", password="strong-pass-123")
        self.category = Category.objects.create(name="Insights", slug="insights")
        self.post = Post.objects.create(
            title="Analytics baseline post",
            slug="analytics-baseline-post",
            excerpt="A post used to verify event tracking.",
            content="<h2>Measurement</h2><p>Baseline analytics content.</p>",
            category=self.category,
            author=self.user,
            image="https://example.com/analytics.jpg",
            status="PUBLISHED",
        )

    def test_search_and_engagement_endpoints_persist_events(self):
        search_response = self.client.post(
            "/api/search/analytics/",
            {
                "event_type": "search_impression",
                "query": "analytics",
                "result_count": 1,
                "clicked_slug": self.post.slug,
                "source": "search-page",
            },
            format="json",
        )

        self.assertEqual(search_response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(
            AnalyticsEvent.objects.filter(event_type=AnalyticsEvent.EventType.SEARCH).count(),
            1,
        )

        engagement_response = self.client.post(
            "/api/analytics/engagement/",
            {
                "slug": self.post.slug,
                "depth_percent": 75,
                "source": "article-page",
            },
            format="json",
        )

        self.assertEqual(engagement_response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(
            AnalyticsEvent.objects.filter(event_type=AnalyticsEvent.EventType.SCROLL_DEPTH).count(),
            1,
        )
