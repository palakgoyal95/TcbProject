"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1800&q=80";

function getRotationDelay(minRotationMs, maxRotationMs) {
  const min = Math.max(1000, Number(minRotationMs) || 10000);
  const max = Math.max(min, Number(maxRotationMs) || 20000);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function HeroPost({
  post,
  posts = [],
  minRotationMs = 10000,
  maxRotationMs = 20000,
  titleFontFamily,
}) {
  const heroPosts = useMemo(() => {
    const source = Array.isArray(posts) && posts.length > 0 ? posts : post ? [post] : [];
    return source.filter(Boolean);
  }, [post, posts]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const resolvedIndex = heroPosts.length > 0 ? activeIndex % heroPosts.length : 0;

  useEffect(() => {
    if (heroPosts.length <= 1 || isPaused) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % heroPosts.length);
    }, getRotationDelay(minRotationMs, maxRotationMs));

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeIndex, heroPosts.length, isPaused, maxRotationMs, minRotationMs]);

  const activePost = heroPosts[resolvedIndex] || heroPosts[0] || null;
  if (!activePost) {
    return (
      <section className="public-panel-dark relative overflow-hidden rounded-[1.75rem] text-white sm:rounded-[2rem]">
        <div className="relative min-h-[22rem] sm:min-h-96">
          <Image
            src={FALLBACK_IMAGE}
            alt="Corporate skyline"
            fill
            priority
            sizes="(max-width: 1280px) 100vw, 1200px"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-linear-to-t from-slate-950/88 via-slate-900/42 to-slate-900/18" />
          <div className="relative z-10 p-5 sm:p-8">
            <p className="inline-flex rounded-full border border-white/18 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100">
              Executive Brief
            </p>
            <h1
              className="mt-4 max-w-4xl text-2xl font-semibold leading-tight sm:text-4xl lg:text-5xl"
              style={titleFontFamily ? { fontFamily: titleFontFamily } : undefined}
            >
              Inside the strategy room: what high-performing teams execute next
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 sm:text-lg">
              Fresh editorial highlights will appear here as soon as published posts are available.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const hasMultiplePosts = heroPosts.length > 1;
  const activeImage = typeof activePost?.imageSrc === "string" && activePost.imageSrc.trim()
    ? activePost.imageSrc
    : FALLBACK_IMAGE;

  return (
    <section
      className="public-panel-dark relative overflow-hidden rounded-[1.75rem] text-white sm:rounded-[2rem]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsPaused(false);
        }
      }}
    >
      <div className="relative min-h-[24rem] sm:min-h-96">
        <Image
          key={activePost.slug || activePost.title || resolvedIndex}
          src={activeImage}
          alt={activePost?.title || "Corporate skyline"}
          fill
          priority={resolvedIndex === 0}
          sizes="(max-width: 1280px) 100vw, 1200px"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-slate-950/88 via-slate-900/42 to-slate-900/18" />

        <div className="relative z-10 p-5 sm:p-8">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <p className="inline-flex rounded-full border border-white/18 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100">
              {activePost?.categoryLabel || "Executive Brief"}
            </p>
            {hasMultiplePosts ? (
              <div className="flex items-center gap-2">
                <span className="hidden rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-100 sm:inline-flex">
                  Rotates every 10-20s
                </span>
                <div className="flex items-center gap-1.5">
                  {heroPosts.map((item, index) => {
                    const isActive = index === resolvedIndex;
                    return (
                      <button
                        key={item?.slug || item?.title || index}
                        type="button"
                        onClick={() => setActiveIndex(index)}
                        suppressHydrationWarning
                        className={`h-2.5 rounded-full transition ${
                          isActive ? "w-8 bg-white" : "w-2.5 bg-white/45 hover:bg-white/70"
                        }`}
                        aria-label={`Show hero post ${index + 1}`}
                      />
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <h1
            className="mt-4 max-w-4xl text-2xl font-semibold leading-tight sm:text-4xl lg:text-5xl"
            style={titleFontFamily ? { fontFamily: titleFontFamily } : undefined}
          >
            {activePost?.title || "Inside the strategy room: what high-performing teams execute next"}
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 sm:text-lg">
            {activePost?.excerpt || "Leadership strategy, market decisions, and execution insights from the corporate desk."}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-slate-100/90 sm:gap-4 sm:text-sm">
            {activePost?.publishedDate ? <span>{activePost.publishedDate}</span> : null}
            {activePost?.readingTime ? <span>{activePost.readingTime}</span> : null}
            {activePost?.authorLabel ? <span>{activePost.authorLabel}</span> : null}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href={activePost?.href || "/blog"}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-[#f6efe2] sm:w-auto sm:py-2.5"
            >
              Read Story
              <span aria-hidden="true">{"->"}</span>
            </Link>
            {hasMultiplePosts ? (
              <button
                type="button"
                onClick={() =>
                  setActiveIndex((current) => (current + 1) % heroPosts.length)
                }
                suppressHydrationWarning
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/18 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/16 sm:w-auto sm:py-2.5"
              >
                Next Highlight
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
