import Image from "next/image";
import Link from "next/link";

import { getInternalSuggestions } from "../lib/api";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80";

function resolveCardImage(post) {
  const candidate = post?.image_url;
  if (typeof candidate !== "string") {
    return FALLBACK_IMAGE;
  }

  const cleaned = candidate.trim();
  if (!cleaned) {
    return FALLBACK_IMAGE;
  }

  if (
    cleaned.startsWith("https://") ||
    cleaned.startsWith("http://") ||
    cleaned.startsWith("/")
  ) {
    return cleaned;
  }

  return FALLBACK_IMAGE;
}

export default async function RelatedArticles({ postId, currentSlug }) {
  const suggestions = await getInternalSuggestions(postId);
  const visibleSuggestions = suggestions
    .filter((item) => item?.slug && item.slug !== currentSlug)
    .slice(0, 3);

  return (
    <section
      className="public-panel-soft rounded-[1.75rem] p-5"
      aria-labelledby="related-articles-title"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 id="related-articles-title" className="text-xl font-semibold text-slate-900">
          Related Articles
        </h2>
        <Link href="/blog" className="text-sm font-semibold text-[#1f7a67] hover:text-[#17352c]">
          View all
        </Link>
      </div>

      {visibleSuggestions.length === 0 ? (
        <p className="public-empty min-h-[120px] rounded-[1.25rem] px-4 py-6 text-sm text-slate-600">
          No related articles available yet for this topic.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleSuggestions.map((post) => {
            const anchorLabel =
              Array.isArray(post?.anchor_suggestions) &&
              typeof post.anchor_suggestions[0] === "string"
                ? post.anchor_suggestions[0]
                : post?.title || "Read this related article";

            return (
              <article
                key={post.id || post.slug}
                className="public-panel-soft group overflow-hidden rounded-[1.35rem] transition hover:-translate-y-0.5"
              >
                <div className="relative h-32">
                  <Image
                    src={resolveCardImage(post)}
                    alt={post?.title || "Related article cover"}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {post?.category_name || "General"}
                  </p>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="mt-1 block text-sm font-semibold leading-snug text-slate-900 group-hover:text-[#1f7a67]"
                  >
                    {post?.title || "Untitled article"}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                    {post?.excerpt || ""}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Suggested anchor:{" "}
                    <span className="font-semibold text-slate-700">{anchorLabel}</span>
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
