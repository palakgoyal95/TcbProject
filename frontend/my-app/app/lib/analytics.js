const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";

function canTrackGa() {
  return typeof window !== "undefined" && typeof window.gtag === "function" && Boolean(GA_MEASUREMENT_ID);
}

export function trackPageView(path) {
  if (!canTrackGa()) {
    return;
  }

  const normalizedPath = String(path || "/");
  window.gtag("event", "page_view", {
    page_path: normalizedPath,
    page_location: window.location.origin + normalizedPath,
    page_title: document.title || "",
  });
}

export function trackPublishEvent({
  postId,
  slug,
  title,
  categoryId,
  wordCount,
} = {}) {
  if (!canTrackGa()) {
    return;
  }

  window.gtag("event", "publish_post", {
    post_id: postId ?? null,
    slug: String(slug || ""),
    title: String(title || ""),
    category_id: categoryId ?? null,
    word_count: Number.parseInt(String(wordCount || 0), 10) || 0,
  });
}
