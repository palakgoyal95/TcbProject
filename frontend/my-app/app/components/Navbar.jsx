"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { trackSearchEvent } from "../lib/api";
import { buildApiUrl } from "../lib/apiConfig";

const primaryLinks = [
  { href: "/blog", label: "Blog" },
  { href: "/categories", label: "Categories" },
  { href: "/contact", label: "Contact" },
  { href: "/about", label: "About" },
];

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text, query) {
  const plainText = String(text || "");
  const terms = String(query || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 1)
    .slice(0, 6);

  if (!plainText || terms.length === 0) {
    return plainText;
  }

  const regex = new RegExp(`(${terms.map((term) => escapeRegex(term)).join("|")})`, "ig");
  const termSet = new Set(terms);

  return plainText.split(regex).map((part, index) => {
    if (termSet.has(part.toLowerCase())) {
      return (
        <mark key={`${part}-${index}`} className="public-mark">
          {part}
        </mark>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function buildPostHref(slug) {
  const normalized = String(slug || "").trim();
  if (!normalized) {
    return "/blog";
  }
  return `/blog/${encodeURIComponent(normalized)}`;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [session, setSession] = useState({
    isChecking: true,
    isAuthenticated: false,
    user: null,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchPreview, setSearchPreview] = useState({
    isLoading: false,
    results: [],
  });
  const [isDesktopPreviewOpen, setIsDesktopPreviewOpen] = useState(false);
  const [isMobilePreviewOpen, setIsMobilePreviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const syncSession = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        if (!cancelled) {
          setSession({
            isChecking: false,
            isAuthenticated: false,
            user: null,
          });
        }
        return;
      }

      try {
        const response = await fetch(buildApiUrl("/me/"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("writer_username");

            if (!cancelled) {
              setSession({
                isChecking: false,
                isAuthenticated: false,
                user: null,
              });
            }
            return;
          }

          if (!cancelled) {
            setSession((previous) => ({
              ...previous,
              isChecking: false,
              isAuthenticated: true,
            }));
          }
          return;
        }

        const payload = await response.json();
        localStorage.setItem("writer_username", payload?.username || "");

        if (!cancelled) {
          setSession({
            isChecking: false,
            isAuthenticated: true,
            user: payload,
          });
        }
      } catch {
        if (!cancelled) {
          setSession((previous) => ({
            ...previous,
            isChecking: false,
            isAuthenticated: true,
          }));
        }
      }
    };

    syncSession();
    window.addEventListener("storage", syncSession);
    window.addEventListener("writer:profile-updated", syncSession);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("writer:profile-updated", syncSession);
    };
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const existingQuery = params.get("q") || "";
    setSearchQuery(existingQuery);
  }, [pathname]);

  useEffect(() => {
    const normalizedQuery = searchQuery.trim();
    if (normalizedQuery.length < 2) {
      setSearchPreview({
        isLoading: false,
        results: [],
      });
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchPreview((previous) => ({
        ...previous,
        isLoading: true,
      }));

      try {
        const params = new URLSearchParams();
        params.set("q", normalizedQuery);
        params.set("page", "1");
        params.set("page_size", "5");
        params.set("sort", "relevance");

        const response = await fetch(buildApiUrl(`/search/?${params.toString()}`));
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(`Search failed with status ${response.status}.`);
        }

        const results = Array.isArray(payload?.results) ? payload.results : [];
        if (!cancelled) {
          setSearchPreview({
            isLoading: false,
            results,
          });

          trackSearchEvent({
            eventType: "preview_impression",
            query: normalizedQuery,
            resultCount: results.length,
            source: "navbar-preview",
          });
        }
      } catch {
        if (!cancelled) {
          setSearchPreview({
            isLoading: false,
            results: [],
          });
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  const isActiveLink = (href) => {
    if (href === "/blog") {
      return pathname === "/blog" || pathname.startsWith("/blog/");
    }
    return pathname === href;
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("writer_username");
    window.dispatchEvent(new Event("writer:profile-updated"));
    setSession({
      isChecking: false,
      isAuthenticated: false,
      user: null,
    });
    router.push("/blog");
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const normalizedQuery = searchQuery.trim();
    if (!normalizedQuery) {
      return;
    }

    trackSearchEvent({
      eventType: "search_impression",
      query: normalizedQuery,
      resultCount: searchPreview.results.length,
      source: "navbar-submit",
    });

    setIsDesktopPreviewOpen(false);
    setIsMobilePreviewOpen(false);
    router.push(`/search?q=${encodeURIComponent(normalizedQuery)}`);
  };

  const isLoggedIn = session.isAuthenticated;
  const writerUsername = session.user?.username || "writer";
  const writerInitial = String(writerUsername || "w").trim().charAt(0).toUpperCase() || "W";

  // Hide Navbar on writer pages as they have their own sidebar
  if (pathname?.startsWith("/writer")) {
    return null;
  }

  return (
    <header className="public-nav-shell sticky top-0 z-50">
      <div className="flex w-full items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6 lg:px-8">
        <Link
          href="/blog"
          className="inline-flex min-w-0 shrink items-center gap-3 rounded-[1.35rem] border border-[rgba(20,44,38,0.1)] bg-white/82 px-3 py-2 text-slate-900 shadow-[0_18px_40px_-34px_rgba(18,33,29,0.35)] transition hover:border-[rgba(20,44,38,0.18)] hover:bg-white"
        >
          <span className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#17352c] text-xs font-black tracking-[0.26em] text-white sm:h-10 sm:w-10">
            CB
          </span>
          <span className="min-w-0 pr-1">
            <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 sm:text-[11px]">
              Editorial Platform
            </span>
            <span className="block truncate text-lg font-semibold leading-none tracking-tight sm:text-2xl lg:text-[28px]">
              CorporateBlog
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-5 lg:flex" aria-label="Primary">
          {primaryLinks.map((item) => {
            const active = isActiveLink(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`public-nav-link pb-1 text-sm transition ${
                  active
                    ? "public-nav-link-active border-b-2 border-[#17352c] font-semibold"
                    : "border-b-2 border-transparent font-medium hover:border-[rgba(20,44,38,0.18)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <form onSubmit={handleSearchSubmit} className="hidden min-w-0 flex-1 md:block">
          <label htmlFor="desktop-nav-search" className="sr-only">
            Search corporate articles
          </label>
          <div className="relative mx-auto max-w-3xl">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              id="desktop-nav-search"
              type="search"
              name="q"
              suppressHydrationWarning
              value={searchQuery}
              autoComplete="off"
              onFocus={() => setIsDesktopPreviewOpen(true)}
              onBlur={() => {
                setTimeout(() => {
                  setIsDesktopPreviewOpen(false);
                }, 120);
              }}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search corporate articles..."
              className="public-input h-12 w-full rounded-full pl-11 pr-32 text-sm"
            />
            <button
              type="submit"
              suppressHydrationWarning
              className="public-button-primary absolute right-1.5 top-1.5 inline-flex h-9 items-center px-4 text-sm font-semibold"
            >
              Search
            </button>

            {isDesktopPreviewOpen && searchQuery.trim().length >= 2 && (
              <div className="public-search-panel absolute left-0 right-0 top-14 z-40 overflow-hidden rounded-[1.5rem]">
                {searchPreview.isLoading ? (
                  <div className="space-y-2 p-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="h-10 animate-pulse rounded-2xl bg-slate-100/85" />
                    ))}
                  </div>
                ) : searchPreview.results.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-600">No quick matches yet.</p>
                ) : (
                  <ul className="max-h-80 overflow-y-auto">
                    {searchPreview.results.map((item) => (
                      <li key={item?.id || item?.slug} className="border-t border-slate-100/80 first:border-t-0">
                        <Link
                          href={buildPostHref(item?.slug)}
                          onClick={() => {
                            trackSearchEvent({
                              eventType: "result_click",
                              query: searchQuery.trim(),
                              resultCount: searchPreview.results.length,
                              clickedSlug: item?.slug,
                              source: "navbar-preview",
                            });
                            setIsDesktopPreviewOpen(false);
                          }}
                          className="block px-4 py-3 transition hover:bg-[rgba(31,122,103,0.06)]"
                        >
                          <p className="text-sm font-semibold text-slate-900">
                            {highlightText(item?.title || "Untitled post", searchQuery)}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                            {highlightText(item?.excerpt || "", searchQuery)}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-2 text-xs text-slate-500">
                  Enter to view full search results.
                </div>
              </div>
            )}
          </div>
        </form>

        <div className="ml-auto hidden shrink-0 items-center gap-2 md:flex">
          {isLoggedIn ? (
            <details className="relative">
              <summary className="inline-grid h-11 w-11 cursor-pointer list-none place-items-center rounded-full border border-[rgba(20,44,38,0.12)] bg-[#17352c] text-sm font-semibold text-white shadow-[0_18px_34px_-26px_rgba(18,33,29,0.75)] transition hover:bg-[#10251f] [&::-webkit-details-marker]:hidden">
                {writerInitial}
              </summary>
              <div className="public-search-panel absolute right-0 top-14 z-30 w-60 overflow-hidden rounded-[1.5rem]">
                <div className="border-b border-slate-200/80 bg-slate-50/70 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Profile</p>
                  <p className="text-sm font-semibold text-slate-900">@{writerUsername}</p>
                </div>
                <div className="space-y-1 p-2.5">
                  <Link
                    href="/writer/published"
                    className="block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-[rgba(31,122,103,0.08)]"
                  >
                    Portal
                  </Link>
                  <Link
                    href="/writer"
                    className="block rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-[rgba(31,122,103,0.08)]"
                  >
                    Write
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </details>
          ) : !session.isChecking ? (
            <>
              <Link
                href="/login"
                className="public-button-secondary px-4 py-2.5 text-sm font-semibold"
              >
                Log In
              </Link>
              <Link
                href="/login?mode=signup"
                className="public-button-primary px-4 py-2.5 text-sm font-semibold"
              >
                Sign Up
              </Link>
            </>
          ) : null}
        </div>

        <details className="relative ml-auto shrink-0 md:hidden">
          <summary className="flex h-11 cursor-pointer list-none items-center gap-1.5 rounded-full border border-[rgba(20,44,38,0.12)] bg-white/86 px-4 text-sm font-semibold text-slate-700 shadow-[0_12px_30px_-24px_rgba(18,33,29,0.3)] transition hover:border-[rgba(20,44,38,0.2)] [&::-webkit-details-marker]:hidden">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
            Menu
          </summary>
          <div className="public-search-panel absolute right-0 top-14 z-30 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-[1.5rem]">
            <div className="space-y-1 p-3">
              {primaryLinks.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={isActiveLink(item.href) ? "page" : undefined}
                  className={`block rounded-xl px-3 py-2.5 text-sm ${
                    isActiveLink(item.href)
                      ? "bg-[#17352c] font-semibold text-white"
                      : "text-slate-700 hover:bg-[rgba(31,122,103,0.08)]"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="border-t border-slate-200/80 p-3">
              {isLoggedIn ? (
                <>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                    <p className="text-sm font-semibold text-slate-900">@{writerUsername}</p>
                  </div>
                  <Link
                    href="/writer/published"
                    className="public-button-primary mt-2 flex px-3 py-2.5 text-center text-sm font-semibold"
                  >
                    Writer Portal
                  </Link>
                  <Link
                    href="/writer"
                    className="public-button-secondary mt-2 flex px-3 py-2.5 text-center text-sm font-semibold"
                  >
                    Write Post
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="public-button-secondary mt-2 flex w-full px-3 py-2.5 text-center text-sm font-semibold"
                  >
                    Logout
                  </button>
                </>
              ) : !session.isChecking ? (
                <>
                  <Link
                    href="/login"
                    className="public-button-secondary flex px-3 py-2.5 text-center text-sm font-semibold"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/login?mode=signup"
                    className="public-button-primary mt-2 flex px-3 py-2.5 text-center text-sm font-semibold"
                  >
                    Sign Up
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        </details>
      </div>

      <div className="border-t border-[rgba(20,44,38,0.08)] px-4 pb-3 pt-3 md:hidden sm:px-6">
        <form onSubmit={handleSearchSubmit}>
          <label htmlFor="mobile-nav-search" className="sr-only">
            Search corporate articles
          </label>
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              id="mobile-nav-search"
              type="search"
              name="q"
              suppressHydrationWarning
              value={searchQuery}
              autoComplete="off"
              onFocus={() => setIsMobilePreviewOpen(true)}
              onBlur={() => {
                setTimeout(() => {
                  setIsMobilePreviewOpen(false);
                }, 120);
              }}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search corporate articles..."
              className="public-input h-12 w-full rounded-full pl-11 pr-28 text-sm"
            />
            <button
              type="submit"
              suppressHydrationWarning
              className="public-button-primary absolute right-1.5 top-1.5 inline-flex h-9 items-center px-3 text-xs font-semibold"
            >
              Search
            </button>

            {isMobilePreviewOpen && searchQuery.trim().length >= 2 && (
              <div className="public-search-panel absolute left-0 right-0 top-14 z-40 overflow-hidden rounded-[1.5rem]">
                {searchPreview.isLoading ? (
                  <div className="space-y-2 p-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="h-10 animate-pulse rounded-2xl bg-slate-100/85" />
                    ))}
                  </div>
                ) : searchPreview.results.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-600">No quick matches yet.</p>
                ) : (
                  <ul className="max-h-80 overflow-y-auto">
                    {searchPreview.results.map((item) => (
                      <li key={item?.id || item?.slug} className="border-t border-slate-100 first:border-t-0">
                        <Link
                          href={buildPostHref(item?.slug)}
                          onClick={() => {
                            trackSearchEvent({
                              eventType: "result_click",
                              query: searchQuery.trim(),
                              resultCount: searchPreview.results.length,
                              clickedSlug: item?.slug,
                              source: "navbar-preview-mobile",
                            });
                            setIsMobilePreviewOpen(false);
                          }}
                          className="block px-4 py-3 transition hover:bg-[rgba(31,122,103,0.06)]"
                        >
                          <p className="text-sm font-semibold text-slate-900">
                            {highlightText(item?.title || "Untitled post", searchQuery)}
                          </p>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                            {highlightText(item?.excerpt || "", searchQuery)}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </form>
      </div>
    </header>
  );
}
