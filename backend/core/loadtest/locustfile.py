from locust import HttpUser, between, task


class BlogTrafficUser(HttpUser):
    """
    Baseline load profile for day-6 performance checks.
    Run with:
      locust -f loadtest/locustfile.py --host http://127.0.0.1:8000
    """

    wait_time = between(0.2, 1.0)

    @task(5)
    def list_posts(self):
        self.client.get("/api/posts/")

    @task(3)
    def popular_posts(self):
        self.client.get("/api/posts/popular/?limit=6")

    @task(2)
    def search_posts(self):
        self.client.get("/api/search/?q=retention&page=1&page_size=12&sort=relevance")

    @task(1)
    def post_detail(self):
        posts_response = self.client.get("/api/posts/")
        if not posts_response.ok:
            return

        payload = posts_response.json() if posts_response.content else []
        if not isinstance(payload, list) or not payload:
            return

        slug = payload[0].get("slug")
        if slug:
            self.client.get(f"/api/posts/{slug}/")

