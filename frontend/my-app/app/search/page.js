import Link from "next/link";

import SearchAnalyticsTracker from "../components/SearchAnalyticsTracker";
import { getCategories, searchPosts } from "../lib/api";

const PAGE_SIZE = 12;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const SORT_OPTIONS = [
  { value: "relevance", label: "Best Match" },
  { value: "date_desc", label: "Newest" },
  { value: "date_asc", label: "Oldest" },
];

function buildPostHref(slug) {
  const normalized = String(slug || "").trim();
  if (!normalized) {
    return "/blog";
  }
  return `/blog/${encodeURIComponent(normalized)}`;
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildSearchHref({ query, sort, page, category }) {
  const params = new URLSearchParams();

  if (query && query.trim()) {
    params.set("q", query.trim());
  }
  if (sort && sort !== "relevance") {
    params.set("sort", sort);
  }
  if (category && category !== "all") {
    params.set("category", category);
  }
  if (page && page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();
  return queryString ? `/search?${queryString}` : "/search";
}

function renderHighlightedText(text, query) {
  const plainText = String(text || "");
  const terms = String(query || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 1)
    .slice(0, 8);

  if (!plainText || terms.length === 0) {
    return plainText;
  }

  const escapedTerms = terms.map((term) => escapeRegex(term));
  const regex = new RegExp(`(${escapedTerms.join("|")})`, "ig");
  const lowerTermSet = new Set(terms);

  return plainText.split(regex).map((part, index) => {
    if (lowerTermSet.has(part.toLowerCase())) {
      return (
        <mark key={`${part}-${index}`} className="public-mark">
          {part}
        </mark>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

export async function generateMetadata({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const rawQuery =
    typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q.trim() : "";

  return {
    title: rawQuery ? `Search: ${rawQuery} | CorporateBlog` : "Search | CorporateBlog",
    description: rawQuery
      ? `Search results for "${rawQuery}" across CorporateBlog posts.`
      : "Search CorporateBlog posts.",
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default async function SearchPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const rawQuery =
    typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q : "";
  const selectedQuery = rawQuery.trim().slice(0, 120);

  const rawSort =
    typeof resolvedSearchParams.sort === "string" ? resolvedSearchParams.sort : "relevance";
  const selectedSort = SORT_OPTIONS.some((option) => option.value === rawSort)
    ? rawSort
    : "relevance";

  const rawCategory =
    typeof resolvedSearchParams.category === "string"
      ? resolvedSearchParams.category
      : "all";
  const rawPage = Number.parseInt(String(resolvedSearchParams.page || "1"), 10);
  const selectedPage = Number.isNaN(rawPage) ? 1 : Math.max(1, rawPage);

  const categories = await getCategories();
  const safeCategories = Array.isArray(categories) ? categories : [];
  const categoryOptions = [
    { value: "all", label: "All Categories" },
    ...safeCategories
      .filter((item) => item?.id != null)
      .map((item) => ({
        value: String(item.id),
        label: item?.name || `Category ${item.id}`,
      })),
  ];
  const selectedCategory = categoryOptions.some((item) => item.value === rawCategory)
    ? rawCategory
    : "all";

  const searchPayload = selectedQuery
    ? await searchPosts({
        query: selectedQuery,
        page: selectedPage,
        pageSize: PAGE_SIZE,
        sort: selectedSort,
        category: selectedCategory,
      })
    : {
        results: [],
        pagination: {
          page: 1,
          total_pages: 0,
          total_count: 0,
          has_next: false,
          has_previous: false,
        },
        meta: { query_time_ms: 0 },
      };

  const results = Array.isArray(searchPayload?.results) ? searchPayload.results : [];
  const pagination = searchPayload?.pagination || {};
  const page = Number.parseInt(String(pagination.page || selectedPage), 10) || 1;
  const totalPages = Number.parseInt(String(pagination.total_pages || 0), 10) || 0;
  const totalCount = Number.parseInt(String(pagination.total_count || 0), 10) || 0;

  const itemListSchema =
    selectedQuery && results.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: results.map((item, index) => ({
            "@type": "ListItem",
            position: (page - 1) * PAGE_SIZE + index + 1,
            name: item?.title || "Untitled",
            url: `${SITE_URL}/blog/${item?.slug || ""}`,
          })),
        }
      : null;

  return (
    <main className="public-shell min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <section className="public-panel mx-auto max-w-6xl rounded-3xl p-6 sm:p-8">
        <p className="public-pill">
          Search
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-slate-900 sm:text-4xl">
          {selectedQuery ? `Results for "${selectedQuery}"` : "Search CorporateBlog"}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Search pages are set to noindex, follow for crawl-budget efficiency.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-500">Sort:</span>
          {SORT_OPTIONS.map((option) => {
            const isSelected = option.value === selectedSort;
            return (
              <Link
                key={option.value}
                href={buildSearchHref({
                  query: selectedQuery,
                  sort: option.value,
                  page: 1,
                  category: selectedCategory,
                })}
                className={`public-chip px-3 py-2 text-sm font-medium ${
                  isSelected ? "public-chip-active" : ""
                }`}
              >
                {option.label}
              </Link>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {categoryOptions.map((option) => {
            const isSelected = option.value === selectedCategory;
            return (
              <Link
                key={option.value}
                href={buildSearchHref({
                  query: selectedQuery,
                  sort: selectedSort,
                  page: 1,
                  category: option.value,
                })}
                className={`public-chip px-3 py-1.5 text-xs font-medium ${
                  isSelected ? "public-chip-active" : ""
                }`}
              >
                {option.label}
              </Link>
            );
          })}
        </div>

        {selectedQuery ? (
          <p className="mt-4 text-sm text-slate-600">
            Found <strong>{totalCount}</strong> matches. Query time:{" "}
            <strong>{searchPayload?.meta?.query_time_ms ?? 0} ms</strong>.
          </p>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            Enter a query in the navbar to start searching posts.
          </p>
        )}

        {selectedQuery && (
          <SearchAnalyticsTracker
            query={selectedQuery}
            resultCount={results.length}
            source="search-page"
          />
        )}

        {selectedQuery && results.length === 0 && (
          <article className="public-empty mt-5 rounded-[1.5rem] p-6 text-center">
            <h2 className="text-xl font-semibold text-slate-900">No results found</h2>
            <p className="mt-2 text-sm text-slate-600">
              Try broader keywords or switch sorting and category filters.
            </p>
          </article>
        )}

        {results.length > 0 && (
          <div className="mt-5 space-y-3">
            {results.map((post) => (
              <article
                key={post?.id || post?.slug}
                className="public-panel-soft rounded-[1.5rem] p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {post?.category_name || "General"}
                </p>
                <Link
                  href={buildPostHref(post?.slug)}
                  className="mt-1 block text-lg font-semibold text-slate-900 hover:text-[#1f7a67]"
                >
                  {renderHighlightedText(post?.title || "Untitled post", selectedQuery)}
                </Link>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {renderHighlightedText(post?.excerpt || "", selectedQuery)}
                </p>
              </article>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <nav className="mt-6 flex flex-wrap items-center justify-center gap-2" aria-label="Search pagination">
            {pagination?.has_previous && (
              <Link
                href={buildSearchHref({
                  query: selectedQuery,
                  sort: selectedSort,
                  page: page - 1,
                  category: selectedCategory,
                })}
                className="public-button-secondary px-3 py-2 text-sm"
              >
                Prev
              </Link>
            )}

            <span className="public-chip-active rounded-full px-3 py-2 text-sm font-semibold">
              {page} / {totalPages}
            </span>

            {pagination?.has_next && (
              <Link
                href={buildSearchHref({
                  query: selectedQuery,
                  sort: selectedSort,
                  page: page + 1,
                  category: selectedCategory,
                })}
                className="public-button-secondary px-3 py-2 text-sm"
              >
                Next
              </Link>
            )}
          </nav>
        )}

        {itemListSchema ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
          />
        ) : null}
      </section>
    </main>
  );
}
