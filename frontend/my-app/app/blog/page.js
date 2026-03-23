import Image from "next/image";
import Link from "next/link";
import { Manrope, Playfair_Display } from "next/font/google";
import { getCategories, getPosts } from "../lib/api";
import { getReadingTime } from "../lib/readingTime";
import HeroPost from "../components/HeroPost";
import Sidebar from "../components/Sidebar";
import SubscribeForm from "../components/SubscribeForm";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["400", "600", "700"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["600", "700"],
});

const PAGE_SIZE = 6;
const HERO_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1800&q=80";
const CARD_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "quick", label: "Quick Reads" },
];

export const revalidate = 900;

function buildBlogHref({ category, sort, page, query }) {
  const params = new URLSearchParams();

  if (category && category !== "all") {
    params.set("category", category);
  }
  if (sort && sort !== "newest") {
    params.set("sort", sort);
  }
  if (typeof query === "string" && query.trim()) {
    params.set("q", query.trim());
  }
  if (page && page > 1) {
    params.set("page", String(page));
  }

  const queryString = params.toString();
  return queryString ? `/blog?${queryString}` : "/blog";
}

function postMatchesQuery(post, searchQuery) {
  if (!searchQuery) {
    return true;
  }

  const haystack = [
    post?.title,
    post?.excerpt,
    post?.category_name,
    post?.author_username,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");

  return haystack.includes(searchQuery.toLowerCase());
}

function readingMinutes(content) {
  const readingLabel = getReadingTime(content);
  const parsedValue = Number.parseInt(readingLabel, 10);
  return Number.isNaN(parsedValue) ? 1 : parsedValue;
}

function readingMinutesForPost(post) {
  const apiMinutes = Number.parseInt(String(post?.reading_time_minutes || ""), 10);
  if (!Number.isNaN(apiMinutes) && apiMinutes > 0) {
    return apiMinutes;
  }

  return readingMinutes(post?.content || post?.excerpt || "");
}

function toCategoryValue(post) {
  const rawValue =
    typeof post?.category === "object" ? post?.category?.id : post?.category;
  return rawValue == null ? null : String(rawValue);
}

function resolveCategoryLabel(post, categoryMap) {
  if (post?.category_name) {
    return post.category_name;
  }

  if (typeof post?.category === "object" && post?.category?.name) {
    return post.category.name;
  }

  const categoryValue = toCategoryValue(post);
  if (categoryValue && categoryMap.has(categoryValue)) {
    return categoryMap.get(categoryValue);
  }

  return "Corporate";
}

function resolveAuthorLabel(post) {
  if (post?.author_username) {
    return post.author_username;
  }

  if (post?.author) {
    return `Author ${post.author}`;
  }

  return "Corporate Desk";
}

function formatDate(dateValue) {
  const parsedDate = dateValue ? new Date(dateValue) : null;

  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return "Freshly published";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsedDate);
}

function excerptSnippet(post, maxLength = 140) {
  const baseText = String(
    post?.excerpt ||
      post?.content ||
      "Leadership strategy, market decisions, and execution insights from the corporate desk."
  ).trim();

  if (baseText.length <= maxLength) {
    return baseText;
  }

  return `${baseText.slice(0, maxLength).trimEnd()}...`;
}

function resolveImageSource(post, fallbackImage) {
  const candidate = post?.image_url || post?.image;
  if (typeof candidate !== "string") {
    return fallbackImage;
  }

  const cleaned = candidate.trim();
  if (!cleaned) {
    return fallbackImage;
  }

  if (
    cleaned.startsWith("https://") ||
    cleaned.startsWith("http://") ||
    cleaned.startsWith("/")
  ) {
    return cleaned;
  }

  return fallbackImage;
}

function sortPosts(posts, selectedSort) {
  const clonedPosts = [...posts];

  if (selectedSort === "oldest") {
    return clonedPosts.sort(
      (left, right) =>
        new Date(left?.created_at || 0).getTime() -
        new Date(right?.created_at || 0).getTime()
    );
  }

  if (selectedSort === "quick") {
    return clonedPosts.sort(
      (left, right) => readingMinutesForPost(left) - readingMinutesForPost(right)
    );
  }

  return clonedPosts.sort(
    (left, right) =>
      new Date(right?.created_at || 0).getTime() -
      new Date(left?.created_at || 0).getTime()
  );
}

function CorporateArticleCard({ post, categoryLabel }) {
  const imageSource = resolveImageSource(post, CARD_FALLBACK_IMAGE);
  const postHref = post?.slug ? `/blog/${post.slug}` : "/blog";

  return (
    <article className="interactive-card public-panel-soft group flex w-full min-w-0 gap-3 rounded-[1.6rem] p-3 transition duration-200 hover:-translate-y-0.5 sm:gap-4 sm:py-4 md:grid md:grid-cols-[220px_1fr]">
      <div className="relative h-[108px] w-[100px] shrink-0 overflow-hidden rounded-[1.2rem] border border-[rgba(20,44,38,0.08)] sm:h-[132px] sm:w-[144px] md:h-32 md:w-auto">
        <Image
          src={imageSource}
          alt={post?.title || "Corporate article cover"}
          fill
          sizes="(max-width: 640px) 100px, (max-width: 768px) 144px, 220px"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div className="flex w-0 min-w-0 flex-1 flex-col justify-center overflow-hidden py-1 sm:py-0 md:w-auto md:flex-none">
        <p className="break-words text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500 sm:text-xs">
          {categoryLabel} · {formatDate(post?.created_at)} · {readingMinutesForPost(post)} min
        </p>
        <Link
          href={postHref}
          className="interactive-link mobile-card-title mt-2 block max-w-full break-words text-[15px] font-semibold leading-5 text-slate-900 sm:text-lg sm:leading-6 md:text-xl md:leading-tight"
        >
          {post?.title || "Boardroom strategies that accelerate delivery"}
        </Link>
        <p className="mobile-card-copy mt-2 max-w-full break-words text-sm leading-5 text-slate-600 sm:leading-6">
          {excerptSnippet(post)}
        </p>
        <p className="mt-2 break-words text-sm font-medium text-slate-700">
          {resolveAuthorLabel(post)}
        </p>
      </div>
    </article>
  );
}

function MovingPostMarquee({ posts, categoryMap }) {
  const marqueePosts = posts.filter((post) => post?.slug).slice(0, 10);
  if (marqueePosts.length === 0) {
    return null;
  }

  const loopedPosts = [...marqueePosts, ...marqueePosts];

  return (
    <section className="public-panel-soft overflow-hidden rounded-[1.5rem] py-2">
      <div className="post-marquee-track flex w-max items-center gap-3 px-2">
        {loopedPosts.map((post, index) => (
          <Link
            key={`${post.slug}-${index}`}
            href={`/blog/${post.slug}`}
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(20,44,38,0.12)] bg-white/84 px-3 py-1.5 text-sm text-slate-700 transition hover:-translate-y-0.5 hover:border-[rgba(20,44,38,0.2)] hover:shadow-sm"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#1f7a67]" />
            <span className="font-semibold">{resolveCategoryLabel(post, categoryMap)}</span>
            <span className="text-slate-500">{post.title}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function BlogPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) || {};
  const [posts, categories] = await Promise.all([getPosts(), getCategories()]);

  const safePosts = Array.isArray(posts) ? posts : [];
  const safeCategories = Array.isArray(categories) ? categories : [];

  const categoryMap = new Map(
    safeCategories
      .filter((category) => category?.id != null)
      .map((category) => [String(category.id), category?.name || "Corporate"])
  );

  const categoryOptions = [
    { value: "all", label: "All Insights" },
    ...safeCategories
      .filter((category) => category?.id != null)
      .map((category) => ({
        value: String(category.id),
        label: category?.name || `Category ${category.id}`,
      })),
  ];

  const rawCategory =
    typeof resolvedSearchParams.category === "string"
      ? resolvedSearchParams.category
      : "all";
  const rawSort =
    typeof resolvedSearchParams.sort === "string" ? resolvedSearchParams.sort : "newest";
  const rawQuery =
    typeof resolvedSearchParams.q === "string" ? resolvedSearchParams.q : "";
  const rawPage = Number.parseInt(String(resolvedSearchParams.page || "1"), 10);

  const selectedCategory = categoryOptions.some((item) => item.value === rawCategory)
    ? rawCategory
    : "all";
  const selectedSort = SORT_OPTIONS.some((item) => item.value === rawSort)
    ? rawSort
    : "newest";
  const selectedQuery = rawQuery.trim().slice(0, 120);

  const queryFilteredPosts = safePosts.filter((post) =>
    postMatchesQuery(post, selectedQuery)
  );

  const filteredPosts =
    selectedCategory === "all"
      ? queryFilteredPosts
      : queryFilteredPosts.filter((post) => toCategoryValue(post) === selectedCategory);

  const sortedPosts = sortPosts(filteredPosts, selectedSort);
  const heroPost = sortedPosts[0] || null;
  const rotatingHeroPosts = sortedPosts.slice(0, 4).map((post) => ({
    slug: post?.slug || "",
    title:
      post?.title ||
      "Inside the strategy room: what high-performing teams execute next",
    excerpt: excerptSnippet(post, 175),
    categoryLabel: resolveCategoryLabel(post, categoryMap),
    publishedDate: formatDate(post?.created_at),
    readingTime: `${readingMinutesForPost(post)} min read`,
    authorLabel: resolveAuthorLabel(post),
    href: post?.slug ? `/blog/${post.slug}` : "/blog",
    imageSrc: resolveImageSource(post, HERO_FALLBACK_IMAGE),
  }));
  const featuredPosts = sortedPosts.slice(1, 4);
  const articlePool = sortedPosts.slice(4);

  const totalPages = Math.max(1, Math.ceil(articlePool.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, Number.isNaN(rawPage) ? 1 : rawPage), totalPages);
  const listStart = (currentPage - 1) * PAGE_SIZE;
  const visibleArticles = articlePool.slice(listStart, listStart + PAGE_SIZE);

  const selectedCategoryLabel =
    categoryOptions.find((option) => option.value === selectedCategory)?.label || "All Insights";
  const selectedSortLabel =
    SORT_OPTIONS.find((option) => option.value === selectedSort)?.label || "Newest";

  const paginationStart = Math.max(1, currentPage - 2);
  const paginationEnd = Math.min(totalPages, currentPage + 2);
  const pageNumbers = Array.from(
    { length: paginationEnd - paginationStart + 1 },
    (_, index) => paginationStart + index
  );

  return (
    <div
      className={`${manrope.variable} ${playfair.variable} public-shell min-h-screen py-6 sm:py-8`}
      style={{ fontFamily: "var(--font-manrope)" }}
    >
      <main className="flex w-full flex-col gap-6 px-3 sm:px-5 lg:px-7">
        <HeroPost
          post={
            heroPost
              ? {
                  slug: heroPost?.slug || "",
                  title:
                    heroPost?.title ||
                    "Inside the strategy room: what high-performing teams execute next",
                  excerpt: excerptSnippet(heroPost, 175),
                  categoryLabel: resolveCategoryLabel(heroPost, categoryMap),
                  publishedDate: formatDate(heroPost?.created_at),
                  readingTime: `${readingMinutesForPost(heroPost)} min read`,
                  authorLabel: resolveAuthorLabel(heroPost),
                  href: heroPost?.slug ? `/blog/${heroPost.slug}` : "/blog",
                  imageSrc: resolveImageSource(heroPost, HERO_FALLBACK_IMAGE),
                }
              : null
          }
          posts={rotatingHeroPosts}
          minRotationMs={10000}
          maxRotationMs={20000}
          titleFontFamily="var(--font-playfair)"
        />

        <MovingPostMarquee posts={sortedPosts} categoryMap={categoryMap} />

        <section className="public-panel-soft rounded-[1.75rem] p-4">
          <p className="text-sm text-slate-600">
            Showing <strong>{filteredPosts.length}</strong> posts in <strong>{selectedCategoryLabel}</strong> sorted by <strong>{selectedSortLabel}</strong>.
            {selectedQuery ? ` Active query: "${selectedQuery}".` : ""}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-500">Sort:</span>
            {SORT_OPTIONS.map((option) => {
              const isSelected = selectedSort === option.value;
              return (
                <Link
                  key={option.value}
                  href={buildBlogHref({
                    category: selectedCategory,
                    sort: option.value,
                    query: selectedQuery,
                    page: 1,
                  })}
                  className={`public-chip px-3 py-2 text-sm font-medium ${
                    isSelected
                      ? "public-chip-active"
                      : ""
                  }`}
                >
                  {option.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {categoryOptions.map((option) => {
              const isSelected = selectedCategory === option.value;
              return (
                <Link
                  key={option.value}
                  href={buildBlogHref({
                    category: option.value,
                    sort: selectedSort,
                    query: selectedQuery,
                    page: 1,
                  })}
                  className={`public-chip px-4 py-2 text-sm font-medium ${
                    isSelected
                      ? "public-chip-active"
                      : ""
                  }`}
                >
                  {option.label}
                </Link>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="min-w-0">
            {featuredPosts.length > 0 && (
              <div className="mb-5 grid gap-3 md:grid-cols-3">
                {featuredPosts.map((post) => {
                  const imageSource = resolveImageSource(post, CARD_FALLBACK_IMAGE);
                  const postHref = post?.slug ? `/blog/${post.slug}` : "/blog";
                  return (
                    <article
                      key={post?.id || post?.slug}
                      className="interactive-card public-panel-soft group flex w-full min-w-0 gap-3 overflow-hidden rounded-[1.5rem] transition duration-200 hover:-translate-y-0.5 md:block"
                    >
                      <div className="relative h-[108px] w-[100px] shrink-0 md:h-40 md:w-auto">
                        <Image
                          src={imageSource}
                          alt={post?.title || "Featured corporate article"}
                          fill
                          sizes="(max-width: 768px) 100px, (max-width: 1024px) 100vw, 33vw"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        />
                      </div>
                      <div className="flex w-0 min-w-0 flex-1 flex-col justify-center overflow-hidden p-3 sm:p-4 md:w-auto md:flex-none">
                        <p className="break-words text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500 sm:text-xs">
                          {resolveCategoryLabel(post, categoryMap)}
                        </p>
                        <Link
                          href={postHref}
                          className="interactive-link mobile-card-title mt-2 block max-w-full break-words text-[15px] font-semibold leading-5 text-slate-900 sm:text-base sm:leading-snug"
                        >
                          {post?.title || "Leadership teams create clarity during transformation"}
                        </Link>
                        <p className="mobile-card-copy mt-2 max-w-full text-sm leading-5 text-slate-600 md:hidden">
                          {excerptSnippet(post, 88)}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            <div className="space-y-3">
              {visibleArticles.map((post) => (
                <CorporateArticleCard
                  key={post?.id || post?.slug || post?.title}
                  post={post}
                  categoryLabel={resolveCategoryLabel(post, categoryMap)}
                />
              ))}

              {visibleArticles.length === 0 && (
                <article className="public-empty rounded-[1.75rem] p-8 text-center">
                  <h3 className="text-xl font-semibold text-slate-800">No corporate posts in this filter yet</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Switch category or sort mode to reveal more content.
                  </p>
                  <div className="mt-5">
                    <Link
                      href="/blog"
                      className="public-button-primary px-4 py-2 text-sm font-medium"
                    >
                      Reset Filters
                    </Link>
                  </div>
                </article>
              )}
            </div>

            {totalPages > 1 && (
              <nav className="mt-6 flex flex-wrap items-center justify-center gap-2" aria-label="Corporate blog pagination">
                {currentPage > 1 && (
                  <Link
                    href={buildBlogHref({
                      category: selectedCategory,
                      sort: selectedSort,
                      query: selectedQuery,
                      page: currentPage - 1,
                    })}
                    className="public-button-secondary rounded-full px-3 py-2 text-sm"
                  >
                    Prev
                  </Link>
                )}

                {pageNumbers.map((pageNumber) => {
                  const isActive = currentPage === pageNumber;
                  return (
                    <Link
                      key={pageNumber}
                      href={buildBlogHref({
                        category: selectedCategory,
                        sort: selectedSort,
                        query: selectedQuery,
                        page: pageNumber,
                      })}
                      className={`public-chip rounded-full px-3 py-2 text-sm font-medium ${
                        isActive ? "public-chip-active" : ""
                      }`}
                    >
                      {pageNumber}
                    </Link>
                  );
                })}

                {currentPage < totalPages && (
                  <Link
                    href={buildBlogHref({
                      category: selectedCategory,
                      sort: selectedSort,
                      query: selectedQuery,
                      page: currentPage + 1,
                    })}
                    className="public-button-secondary rounded-full px-3 py-2 text-sm"
                  >
                    Next
                  </Link>
                )}
              </nav>
            )}
          </article>

          <div className="min-w-0">
            <Sidebar />
          </div>
        </section>

        <footer className="public-panel-dark rounded-[2rem] px-6 py-8 text-slate-100 sm:px-8">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <h3 className="text-xl font-semibold text-white" style={{ fontFamily: "var(--font-playfair)" }}>
                TCB Corporate
              </h3>
              <p className="mt-3 text-sm text-slate-200/85">
                Clear business writing for leaders building products, systems, and teams.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-200/80">Company</h4>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="/about" className="transition hover:text-cyan-200">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="transition hover:text-cyan-200">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="/categories" className="transition hover:text-cyan-200">
                    Categories
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-200/80">Support</h4>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="/contact" className="transition hover:text-cyan-200">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="/faq" className="transition hover:text-cyan-200">
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link href="/editorial-policy" className="transition hover:text-cyan-200">
                    Editorial Policy
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-200/80">Get Updates</h4>
              <div className="mt-3">
                <SubscribeForm />
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-white/20 pt-4 text-xs text-slate-200/80">
            <p>2026 TCB Corporate. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <Link href="/privacy-policy" className="hover:text-cyan-200">
                Privacy Policy
              </Link>
              <Link href="/terms-of-service" className="hover:text-cyan-200">
                Terms of Service
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
