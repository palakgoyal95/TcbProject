"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const AuthPromptModal = dynamic(() => import("./AuthPromptModal"), {
  loading: () => null,
  ssr: false,
});

function formatViews(value) {
  const numericValue = Number.parseInt(String(value || 0), 10);
  if (Number.isNaN(numericValue) || numericValue <= 0) {
    return "0 views";
  }

  return `${numericValue.toLocaleString("en-US")} views`;
}

const BENEFIT_CARDS = [
  {
    eyebrow: "Editorial Signal",
    title: "Track what is gaining traction across the content library.",
    description:
      "Use trending performance as a lightweight planning signal for what readers are actually opening now.",
    tone: "border-cyan-200/80 bg-cyan-50/85",
  },
  {
    eyebrow: "Category Coverage",
    title: "Navigate strategy, operations, product, and growth more cleanly.",
    description:
      "Move from broad browsing into focused reading with category-led pathways and clearer information architecture.",
    tone: "border-blue-200/80 bg-blue-50/85",
  },
  {
    eyebrow: "Writer Workflow",
    title: "Keep publishing tasks behind a secure and more professional access layer.",
    description:
      "Writers can create, review, and manage posts from one account-based workspace designed for ongoing editorial work.",
    tone: "border-emerald-200/80 bg-emerald-50/85",
  },
];

const PLAYBOOK_ITEMS = [
  "Review top-performing stories before planning the next editorial cycle.",
  "Use category views to route reading toward the right team or function.",
  "Open the writer workspace to publish and manage articles with account access.",
];

/**
 * @param {{ popularPosts?: Array<Record<string, unknown>> }} props
 */
export default function HomeLanding({ popularPosts = [] }) {
  const router = useRouter();
  const [authState, setAuthState] = useState({
    mounted: false,
    isAuthenticated: false,
    writerName: "Writer",
  });
  const [authPrompt, setAuthPrompt] = useState({
    open: false,
    variant: "welcome",
  });

  useEffect(() => {
    const syncSession = () => {
      const token = localStorage.getItem("token");
      setAuthState({
        mounted: true,
        isAuthenticated: Boolean(token),
        writerName: localStorage.getItem("writer_username") || "Writer",
      });
    };

    syncSession();
    window.addEventListener("storage", syncSession);
    window.addEventListener("writer:profile-updated", syncSession);

    return () => {
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("writer:profile-updated", syncSession);
    };
  }, []);

  useEffect(() => {
    if (!authState.mounted || authState.isAuthenticated) {
      return undefined;
    }

    const hasShownPrompt = sessionStorage.getItem("home-auth-prompt-shown") === "1";
    if (hasShownPrompt) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      sessionStorage.setItem("home-auth-prompt-shown", "1");
      setAuthPrompt({
        open: true,
        variant: "welcome",
      });
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [authState.isAuthenticated, authState.mounted]);

  const visiblePosts = Array.isArray(popularPosts)
    ? popularPosts.filter((post) => post?.slug).slice(0, 5)
    : [];

  const handleProtectedAction = (variant, href) => {
    if (authState.isAuthenticated) {
      router.push(href);
      return;
    }

    setAuthPrompt({
      open: true,
      variant,
    });
  };

  return (
    <>
      <main className="public-shell min-h-screen px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <section className="relative mx-auto max-w-7xl space-y-8">
          <article className="public-panel overflow-hidden rounded-[2.5rem] p-6 sm:p-8 lg:p-10">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-start">
              <div>
                <p className="public-pill">
                  CorporateBlog
                </p>
                <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-[4.2rem] lg:leading-[1.02]">
                  Professional business publishing for teams that move from insight to action.
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
                  Read high-signal articles, monitor what is trending, and give writers a cleaner
                  workspace for publishing and managing content with more confidence.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Link
                    href="/blog"
                    className="public-button-primary px-6 py-3.5 text-sm font-semibold"
                  >
                    Explore Articles
                  </Link>
                  <Link
                    href="/categories"
                    className="public-button-secondary px-6 py-3.5 text-sm font-semibold"
                  >
                    Browse Categories
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleProtectedAction("writer", "/writer")}
                    className="public-button-secondary px-6 py-3.5 text-sm font-semibold"
                  >
                    {authState.isAuthenticated ? "Open Writer Desk" : "Unlock Writer Access"}
                  </button>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <article className="public-metric rounded-[1.4rem] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">
                      Refresh Cycle
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-slate-950">15 min</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Trending signals stay current throughout the day.
                    </p>
                  </article>
                  <article className="public-metric rounded-[1.4rem] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1f7a67]">
                      Coverage
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-slate-950">Strategy to Growth</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Scan categories built for operational and leadership reading.
                    </p>
                  </article>
                  <article className="public-metric rounded-[1.4rem] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#1f7a67]">
                      Access
                    </p>
                    <p className="mt-3 text-2xl font-semibold text-slate-950">
                      {authState.isAuthenticated ? `@${authState.writerName}` : "Guest Mode"}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {authState.isAuthenticated
                        ? "Your account is ready for publishing and post management."
                        : "Browse publicly now, then sign in when you need the writer workspace."}
                    </p>
                  </article>
                </div>
              </div>

              <aside className="public-panel-dark relative overflow-hidden rounded-4xl p-6 text-white sm:p-7">
                <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top_left,rgba(246,239,226,0.18),transparent_55%)]" />
                <div className="relative">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/85">
                    Workspace Overview
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold leading-tight">
                    A more professional front door for readers, editors, and writers.
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    Keep the public experience clean while directing authenticated users into a
                    secure publishing flow with less friction.
                  </p>

                  <div className="mt-6 space-y-3">
                    <div className="rounded-[1.25rem] border border-white/12 bg-white/8 p-4 backdrop-blur">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100/80">
                        Reader Experience
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        Browse trending stories, category coverage, and editorial context without
                        forcing sign-in too early.
                      </p>
                    </div>
                    <div className="rounded-[1.25rem] border border-white/12 bg-white/8 p-4 backdrop-blur">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100/80">
                        Writer Protection
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        Open a login prompt when guests try to access publishing tools or protected
                        workflow actions.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    {authState.isAuthenticated ? (
                      <button
                        type="button"
                        onClick={() => router.push("/writer/published")}
                        className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#f6efe2]"
                      >
                        Go to Published Desk
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleProtectedAction("welcome", "/login")}
                        className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#f6efe2]"
                      >
                        Ask Me to Log In
                      </button>
                    )}
                    <Link
                      href="/contact"
                      className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/16"
                    >
                      Contact Editorial Team
                    </Link>
                  </div>
                </div>
              </aside>
            </div>
          </article>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
            <article className="public-panel-soft rounded-4xl p-6 sm:p-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="public-eyebrow">
                    Trending Intelligence
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                    What readers are opening right now
                  </h2>
                </div>
                <Link
                  href="/blog"
                  className="text-sm font-semibold text-cyan-700 transition hover:text-cyan-900"
                >
                  View all posts
                </Link>
              </div>

              {visiblePosts.length === 0 ? (
                <p className="public-empty mt-6 rounded-[1.35rem] px-4 py-5 text-sm text-slate-600">
                  Trending stories will appear here as view data updates.
                </p>
              ) : (
                <ol className="mt-6 space-y-3">
                  {visiblePosts.map((post, index) => (
                    <li key={post?.id || post?.slug}>
                      <Link
                        href={`/blog/${post.slug}`}
                        className="public-panel-soft group flex gap-4 rounded-[1.4rem] px-4 py-4 transition hover:-translate-y-0.5"
                      >
                        <span className="inline-grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#17352c] text-sm font-semibold text-white">
                          0{index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="public-pill">
                            {post?.category_name || "General"}
                          </span>
                          <span className="mt-3 block text-lg font-semibold text-slate-900 group-hover:text-[#1f7a67]">
                            {post?.title || "Untitled post"}
                          </span>
                          <span className="mt-2 block text-sm leading-6 text-slate-600">
                            {post?.excerpt || "Open the article to review the latest details and reader interest."}
                          </span>
                          <span className="mt-3 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                            {formatViews(post?.views_count)}
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </article>

            <div className="space-y-6">
              <article className="public-panel-soft rounded-4xl p-6 sm:p-8">
                <p className="public-eyebrow">
                  Editorial Playbook
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  Keep the reading experience useful and the workflow controlled
                </h2>
                <ul className="mt-5 space-y-3">
                  {PLAYBOOK_ITEMS.map((item, index) => (
                    <li
                      key={item}
                      className="public-note flex gap-3 rounded-[1.25rem] px-4 py-3"
                    >
                      <span className="inline-grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[rgba(31,122,103,0.12)] text-xs font-semibold text-[#1f7a67]">
                        {index + 1}
                      </span>
                      <span className="text-sm leading-6 text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </article>

              <article className="public-panel-soft rounded-4xl p-6 sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1f7a67]">
                  Protected Access
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  Prompt guests cleanly instead of sending them into a dead end
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Writer-only actions now open a professional login/signup popup so the journey
                  feels intentional and guided.
                </p>
                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => handleProtectedAction("writer", "/writer")}
                    className="public-button-primary px-5 py-3 text-sm font-semibold"
                  >
                    Preview Login Prompt
                  </button>
                  <Link
                    href="/login"
                    className="public-button-secondary px-5 py-3 text-sm font-semibold"
                  >
                    Go to Login Page
                  </Link>
                </div>
              </article>
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-3">
            {BENEFIT_CARDS.map((card, index) => (
              <article
                key={card.title}
                className={`public-panel-soft rounded-[1.8rem] p-6 ${card.tone}`}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {card.eyebrow}
                </p>
                <h2 className="mt-3 text-xl font-semibold leading-tight text-slate-950">
                  {card.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{card.description}</p>
                {index === 2 ? (
                  <button
                    type="button"
                    onClick={() => handleProtectedAction("writer", "/writer")}
                    className="public-button-secondary mt-6 px-4 py-2.5 text-sm font-semibold"
                  >
                    {authState.isAuthenticated ? "Open Workspace" : "Request Sign-In"}
                  </button>
                ) : (
                  <Link
                    href={index === 0 ? "/blog" : "/categories"}
                    className="public-button-secondary mt-6 px-4 py-2.5 text-sm font-semibold"
                  >
                    {index === 0 ? "Review Stories" : "View Categories"}
                  </Link>
                )}
              </article>
            ))}
          </section>
        </section>
      </main>

      {authPrompt.open ? (
        <AuthPromptModal
          open={authPrompt.open}
          variant={authPrompt.variant}
          onClose={() =>
            setAuthPrompt((current) => ({
              ...current,
              open: false,
            }))
          }
        />
      ) : null}
    </>
  );
}
