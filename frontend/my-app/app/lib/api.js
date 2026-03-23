import { buildApiUrl } from "./apiConfig";

const PUBLIC_CONTENT_REVALIDATE_SECONDS = 900;

export async function getPosts() {
  try {
    const res = await fetch(buildApiUrl("/posts/"), {
      next: { revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS },
    });

    if (!res.ok) {
      return [];
    }

    const payload = await res.json().catch(() => []);
    return Array.isArray(payload) ? payload : [];
  } catch {
    return [];
  }
}

export async function getPost(slug) {
  try {
    const res = await fetch(buildApiUrl(`/posts/${slug}/`), {
      next: { revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS },
    });

    if (!res.ok) {
      return null;
    }

    const payload = await res.json().catch(() => null);
    return payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload
      : null;
  } catch {
    return null;
  }
}

export async function getInternalSuggestions(postId) {
  if (!postId) {
    return [];
  }

  try {
    const response = await fetch(
      buildApiUrl(`/posts/${encodeURIComponent(postId)}/internal-suggestions/`),
      {
        next: { revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS },
      }
    );

    if (!response.ok) {
      return [];
    }

    const payload = await response.json().catch(() => ({}));
    const suggestions = payload?.suggestions;
    return Array.isArray(suggestions) ? suggestions : [];
  } catch {
    return [];
  }
}

export async function getPopularPosts(limit = 6) {
  try {
    const response = await fetch(
      buildApiUrl(`/posts/popular/?limit=${encodeURIComponent(limit)}`),
      {
        next: { revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS },
      }
    );

    if (!response.ok) {
      return [];
    }

    const payload = await response.json().catch(() => ({}));
    if (Array.isArray(payload)) {
      return payload;
    }

    const results = payload?.results;
    return Array.isArray(results) ? results : [];
  } catch {
    return [];
  }
}

export async function searchPosts({
  query,
  page = 1,
  pageSize = 12,
  sort = "relevance",
  category = "",
} = {}) {
  const normalizedQuery = String(query || "").trim();
  if (!normalizedQuery) {
    return {
      results: [],
      pagination: {
        page: 1,
        page_size: pageSize,
        total_count: 0,
        total_pages: 0,
        has_next: false,
        has_previous: false,
      },
      meta: {
        query: "",
        sort: "relevance",
        query_time_ms: 0,
        terms: [],
      },
    };
  }

  try {
    const params = new URLSearchParams();
    params.set("q", normalizedQuery);
    params.set("page", String(page));
    params.set("page_size", String(pageSize));
    params.set("sort", sort || "relevance");
    if (category && category !== "all") {
      params.set("category", String(category));
    }

    const response = await fetch(buildApiUrl(`/search/?${params.toString()}`), {
      next: { revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      throw new Error(`Search request failed with status ${response.status}.`);
    }

    const payload = await response.json().catch(() => ({}));
    return {
      results: Array.isArray(payload?.results) ? payload.results : [],
      pagination: payload?.pagination || {},
      meta: payload?.meta || {},
    };
  } catch {
    return {
      results: [],
      pagination: {
        page: 1,
        page_size: pageSize,
        total_count: 0,
        total_pages: 0,
        has_next: false,
        has_previous: false,
      },
      meta: {
        query: normalizedQuery,
        sort: sort || "relevance",
        query_time_ms: 0,
        terms: [],
      },
    };
  }
}

export async function trackSearchEvent({
  eventType,
  query,
  resultCount = 0,
  clickedSlug = "",
  source = "",
} = {}) {
  const normalizedEventType = String(eventType || "").trim();
  if (!normalizedEventType) {
    return;
  }

  try {
    await fetch(buildApiUrl("/search/analytics/"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: normalizedEventType,
        query: String(query || "").trim(),
        result_count: Number.parseInt(String(resultCount || 0), 10) || 0,
        clicked_slug: String(clickedSlug || "").trim(),
        source: String(source || "").trim(),
      }),
      keepalive: true,
    });
  } catch {}
}

export async function getCategories() {
  try {
    const res = await fetch(buildApiUrl("/categories/"), {
      next: { revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      return [];
    }
    return await res.json();
  } catch {
    return [];
  }
}

function extractApiError(payload) {
  if (!payload || typeof payload !== "object") {
    return "Something went wrong. Please try again.";
  }

  if (typeof payload.detail === "string" && payload.detail.trim()) {
    return payload.detail;
  }

  const [firstKey] = Object.keys(payload);
  const firstValue = payload[firstKey];
  if (Array.isArray(firstValue) && typeof firstValue[0] === "string") {
    return firstValue[0];
  }

  if (typeof firstValue === "string") {
    return firstValue;
  }

  return "Something went wrong. Please try again.";
}

export async function submitSubscription(email) {
  const response = await fetch(buildApiUrl("/subscriptions/"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(extractApiError(payload));
  }

  return payload;
}

export async function submitContactMessage({ name, email, subject, message }) {
  const response = await fetch(buildApiUrl("/contact/"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, email, subject, message }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(extractApiError(payload));
  }

  return payload;
}

export async function getPostComments(slug) {
  const response = await fetch(buildApiUrl(`/posts/${encodeURIComponent(slug)}/comments/`), {
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload : [];
}

export async function submitPostComment(slug, content, token) {
  const response = await fetch(buildApiUrl(`/posts/${encodeURIComponent(slug)}/comments/`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(extractApiError(payload));
  }

  return payload;
}
