import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import DeferredPostComments from "../../components/DeferredPostComments";
import PostViewTracker from "../../components/PostViewTracker";
import RelatedArticles from "../../components/RelatedArticles";
import RelatedArticlesSkeleton from "../../components/RelatedArticlesSkeleton";
import { getCategories, getPost, getPosts } from "../../lib/api";
import { getReadingTime } from "../../lib/readingTime";

export const revalidate = 900;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://example.com";

export async function generateStaticParams() {
  const posts = await getPosts();
  const safePosts = Array.isArray(posts) ? posts : [];

  return safePosts
    .filter((post) => post?.slug)
    .map((post) => ({
      slug: post.slug,
    }));
}

function resolveCategoryName(post, categories) {
  const safeCategories = Array.isArray(categories) ? categories : [];
  const categoryId = typeof post.category === "object" ? post.category?.id : post.category;
  const category = safeCategories.find((item) => item.id === categoryId);
  return (
    category?.name ||
    (typeof post.category === "object" ? post.category?.name : null) ||
    `Category ${categoryId || "General"}`
  );
}

function resolveAuthorName(post) {
  return post?.author_username || (post?.author ? `Author ${post.author}` : "Editorial Desk");
}

function resolveImageSource(post) {
  const candidate = post?.image_url || post?.image;
  if (typeof candidate === "string" && candidate.trim()) {
    return candidate.trim();
  }
  return "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1800&q=80";
}

function formatPublishedDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "Recently published";
  }
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function normalizeFaqBlocks(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => ({
      question: String(item?.question || "").trim(),
      answer: String(item?.answer || "").trim(),
    }))
    .filter((item) => item.question && item.answer)
    .slice(0, 12);
}

function extractPlainText(value) {
  return String(value || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildHeadingSlug(value) {
  return extractPlainText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function prepareArticleMarkup(html) {
  const usedIds = new Map();
  const headings = [];

  const content = String(html || "").replace(
    /<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (match, level, attrs = "", inner = "") => {
      const text = extractPlainText(inner);
      if (!text) {
        return match;
      }

      const existingIdMatch = String(attrs).match(/\sid=(["'])(.*?)\1/i);
      const baseId = buildHeadingSlug(text) || `section-${headings.length + 1}`;
      const count = usedIds.get(baseId) || 0;
      usedIds.set(baseId, count + 1);
      const resolvedId = existingIdMatch?.[2] || (count > 0 ? `${baseId}-${count + 1}` : baseId);

      headings.push({
        id: resolvedId,
        text,
        level: Number(level),
      });

      if (existingIdMatch) {
        return match;
      }

      return `<h${level}${attrs} id="${resolvedId}">${inner}</h${level}>`;
    }
  );

  return {
    html: content,
    headings,
  };
}

export default async function BlogPostPage({ params }) {
  const { slug } = await params;
  const [post, categories] = await Promise.all([getPost(slug), getCategories()]);

  if (!post || post.detail) {
    notFound();
  }

  const categoryName = resolveCategoryName(post, categories);
  const authorName = resolveAuthorName(post);
  const imageSource = resolveImageSource(post);
  const publishedDate = formatPublishedDate(post?.created_at);
  const readingTime = getReadingTime(post.content);
  const rawContent = typeof post?.content === "string" ? post.content : "";
  const hasHtmlMarkup = /<\/?[a-z][\s\S]*>/i.test(rawContent);
  const preparedArticle = hasHtmlMarkup
    ? prepareArticleMarkup(rawContent)
    : { html: rawContent, headings: [] };
  const articleHeadings = preparedArticle.headings.slice(0, 10);
  const faqItems = normalizeFaqBlocks(post?.faq_blocks);
  const authorInitials =
    authorName
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ED";
  const summaryText =
    String(post?.excerpt || "").trim() ||
    extractPlainText(rawContent).slice(0, 220) ||
    "A structured reading brief for this article.";
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post?.title || "Corporate blog article",
    description: post?.excerpt || "",
    author: {
      "@type": "Person",
      name: authorName,
    },
    publisher: {
      "@type": "Organization",
      name: "TCB Corporate",
    },
    datePublished: post?.created_at || null,
    image: [imageSource],
    articleSection: categoryName,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${slug}`,
    },
  };
  const faqSchema =
    faqItems.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqItems.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer,
            },
          })),
        }
      : null;

  return (
    <main className="public-shell min-h-screen">
      <PostViewTracker slug={slug} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      {faqSchema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      ) : null}

      <section className="px-4 py-4 sm:px-6 lg:px-8">
        <div className="public-panel mx-auto max-w-screen-2xl overflow-hidden rounded-[2.5rem] p-5 sm:p-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] xl:items-stretch">
            <div className="flex flex-col justify-between">
              <div>
                <span className="public-eyebrow">Feature Article</span>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="public-pill">{categoryName}</span>
                  <span className="public-pill">{readingTime}</span>
                  {faqItems.length > 0 ? <span className="public-pill">{faqItems.length} FAQs</span> : null}
                </div>

                <h1 className="mt-5 max-w-4xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl lg:text-[3.6rem] lg:leading-[1.02]">
                  {post.title}
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
                  {summaryText}
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#17352c] text-sm font-black tracking-[0.18em] text-white">
                    {authorInitials}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900">{authorName}</p>
                    <p className="text-sm text-slate-500">
                      Published {publishedDate}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="#article-content"
                    className="public-button-primary px-5 py-3 text-sm font-semibold"
                  >
                    Start Reading
                  </Link>
                  <Link
                    href="/blog"
                    className="public-button-secondary px-5 py-3 text-sm font-semibold"
                  >
                    Back to Blog
                  </Link>
                  <Link
                    href="#article-comments"
                    className="public-button-secondary px-5 py-3 text-sm font-semibold"
                  >
                    Jump to Comments
                  </Link>
                </div>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="public-metric rounded-[1.35rem] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Author
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{authorName}</p>
                </div>
                <div className="public-metric rounded-[1.35rem] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Published
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{publishedDate}</p>
                </div>
                <div className="public-metric rounded-[1.35rem] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Reading Time
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{readingTime}</p>
                </div>
                <div className="public-metric rounded-[1.35rem] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Category
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{categoryName}</p>
                </div>
              </div>
            </div>

            <div className="relative min-h-[320px] overflow-hidden rounded-[2rem] border border-[rgba(20,44,38,0.08)] bg-slate-100">
              <Image
                src={imageSource}
                alt={post?.title || "Blog cover"}
                fill
                priority
                sizes="(max-width: 1280px) 100vw, 40vw"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 rounded-[1.4rem] border border-white/18 bg-slate-950/50 p-4 text-white backdrop-blur-md">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
                  Reading Brief
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-100">
                  {summaryText}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-8 pt-2 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-screen-2xl grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="public-panel-soft rounded-[1.75rem] p-5">
              <span className="public-eyebrow">Article Briefing</span>
              <div className="mt-4 flex items-start gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.35rem] bg-[#17352c] text-base font-black tracking-[0.18em] text-white">
                  {authorInitials}
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-slate-900">{authorName}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Published {publishedDate} in {categoryName}.
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-2 text-sm text-slate-600">
                <p>
                  <span className="font-semibold text-slate-900">Read time:</span> {readingTime}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Summary:</span> {summaryText}
                </p>
              </div>
            </div>

            {articleHeadings.length > 0 ? (
              <nav className="public-panel-soft rounded-[1.75rem] p-5" aria-labelledby="article-outline-title">
                <h2
                  id="article-outline-title"
                  className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500"
                >
                  In This Article
                </h2>
                <div className="mt-4 space-y-2">
                  {articleHeadings.map((heading) => (
                    <Link
                      key={heading.id}
                      href={`#${heading.id}`}
                      className={`block rounded-[1rem] px-3 py-2 text-sm transition hover:bg-[rgba(31,122,103,0.08)] hover:text-[#17352c] ${
                        heading.level === 3
                          ? "ml-4 text-slate-500"
                          : "font-semibold text-slate-700"
                      }`}
                    >
                      {heading.text}
                    </Link>
                  ))}
                </div>
              </nav>
            ) : null}

            <div className="public-panel-soft rounded-[1.75rem] p-5">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Quick Navigation
              </h2>
              <div className="mt-4 flex flex-col gap-3">
                <Link href="/blog" className="public-button-secondary px-4 py-3 text-sm font-semibold">
                  Back to Blog
                </Link>
                <Link href="#article-content" className="public-button-secondary px-4 py-3 text-sm font-semibold">
                  Jump to Content
                </Link>
                {faqItems.length > 0 ? (
                  <Link href="#article-faq" className="public-button-secondary px-4 py-3 text-sm font-semibold">
                    Jump to FAQ
                  </Link>
                ) : null}
                <Link href="#article-comments" className="public-button-secondary px-4 py-3 text-sm font-semibold">
                  Jump to Comments
                </Link>
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            <section id="article-content" className="public-panel rounded-[1.85rem] px-5 py-6 scroll-mt-28 sm:px-8 sm:py-8">
              <div className="public-note mb-6 rounded-[1.5rem] p-5">
                <p className="public-eyebrow">Reading Brief</p>
                <p className="mt-4 text-base leading-7 text-slate-700">
                  {summaryText}
                </p>
              </div>

              {hasHtmlMarkup ? (
                <div
                  className="prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-[#1f7a67] hover:prose-a:text-[#17352c] [&_h2]:scroll-mt-28 [&_h3]:scroll-mt-28 [&_img]:my-5 [&_img]:rounded-xl [&_img]:border [&_img]:border-slate-200 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-1 [&_aside.tcb-callout]:my-6 [&_aside.tcb-callout]:rounded-xl [&_aside.tcb-callout]:border [&_aside.tcb-callout]:border-amber-200 [&_aside.tcb-callout]:bg-amber-50 [&_aside.tcb-callout]:px-4 [&_aside.tcb-callout]:py-3 [&_aside.tcb-callout]:text-slate-800"
                  dangerouslySetInnerHTML={{ __html: preparedArticle.html }}
                />
              ) : (
                <div className="whitespace-pre-line text-base leading-8 text-slate-700">
                  {rawContent}
                </div>
              )}
            </section>

            {faqItems.length > 0 ? (
              <section
                id="article-faq"
                className="public-panel-soft rounded-[1.75rem] px-5 py-6 scroll-mt-28 sm:px-8"
              >
                <h2 className="text-xl font-semibold text-slate-900">Frequently Asked Questions</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Quick answers for common reader questions about this topic.
                </p>
                <div className="mt-4 space-y-3">
                  {faqItems.map((item, index) => (
                    <details
                      key={`${item.question}-${index}`}
                      className="public-note group rounded-[1.25rem] px-4 py-3"
                    >
                      <summary className="cursor-pointer list-none pr-6 text-sm font-semibold text-slate-900 marker:content-none">
                        {item.question}
                      </summary>
                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                        {item.answer}
                      </p>
                    </details>
                  ))}
                </div>
              </section>
            ) : null}

            <Suspense fallback={<RelatedArticlesSkeleton />}>
              <RelatedArticles postId={post?.id} currentSlug={slug} />
            </Suspense>

            <div id="article-comments" className="scroll-mt-28">
              <DeferredPostComments slug={slug} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
