import Link from "next/link";

function formatViews(value) {
  const numericValue = Number.parseInt(String(value || 0), 10);
  if (Number.isNaN(numericValue) || numericValue <= 0) {
    return "0 views";
  }
  return `${numericValue.toLocaleString("en-US")} views`;
}

export default function TrendingNowWidget({
  posts,
  title = "Trending Now",
  className = "",
}) {
  const safePosts = Array.isArray(posts) ? posts : [];
  const visiblePosts = safePosts.filter((post) => post?.slug).slice(0, 5);

  return (
    <section
      className={`public-panel-soft rounded-[1.75rem] p-5 ${className}`.trim()}
      aria-labelledby="trending-now-title"
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          id="trending-now-title"
          className="public-eyebrow"
        >
          {title}
        </h3>
        <Link href="/blog" className="text-xs font-semibold text-[#1f7a67] hover:text-[#17352c]">
          All posts
        </Link>
      </div>

      {visiblePosts.length === 0 ? (
        <p className="public-empty mt-4 rounded-[1.25rem] px-4 py-4 text-sm text-slate-600">
          Trending data is warming up.
        </p>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {visiblePosts.map((post, index) => (
            <li key={post?.id || post?.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="group flex gap-3 rounded-[1.2rem] border border-[rgba(20,44,38,0.08)] bg-white/78 px-3 py-3 transition hover:border-[rgba(31,122,103,0.18)] hover:bg-white"
              >
                <span className="inline-grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#17352c] text-xs font-semibold text-white">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800 group-hover:text-[#1f7a67]">
                    {post?.title || "Untitled post"}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {formatViews(post?.views_count)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
