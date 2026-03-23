"use client";

import Link from "next/link";
import { useEffect } from "react";

const PROMPT_CONTENT = {
  welcome: {
    eyebrow: "Professional Access",
    title: "Sign in to unlock the full CorporateBlog workspace.",
    description:
      "Use a writer account to publish articles, manage live posts, and keep your editorial workflow in one place while continuing to browse public content anytime.",
    highlights: [
      {
        title: "Writer Studio",
        note: "Draft, upload media, and publish from one focused workspace.",
      },
      {
        title: "Published Desk",
        note: "Review live posts, update details, and manage ongoing content.",
      },
      {
        title: "Team Workflow",
        note: "Move faster with structured editorial tools and clear routing.",
      },
    ],
  },
  writer: {
    eyebrow: "Writer Workspace",
    title: "Log in before opening the writer desk.",
    description:
      "The writer workspace is protected so posts, uploads, and publishing tools stay available only to authenticated team members.",
    highlights: [
      {
        title: "Secure Publishing",
        note: "Only signed-in users can create or update articles.",
      },
      {
        title: "Saved Sessions",
        note: "Pick up draft work with your account-linked publishing flow.",
      },
      {
        title: "Cleaner Review",
        note: "Keep editorial actions organized in one controlled workspace.",
      },
    ],
  },
};

export default function AuthPromptModal({
  open,
  variant = "welcome",
  onClose,
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const content = PROMPT_CONTENT[variant] || PROMPT_CONTENT.welcome;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6 sm:px-6">
      <button
        type="button"
        aria-label="Close authentication prompt"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-prompt-title"
        className="public-panel-dark relative w-full max-w-2xl overflow-hidden rounded-[2rem] p-6 text-white shadow-[0_40px_100px_-44px_rgba(15,23,42,0.9)] sm:p-8"
      >
        <div className="absolute -right-12 top-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-44 w-44 rounded-full bg-[rgba(190,116,63,0.18)] blur-3xl" />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/8 text-white transition hover:bg-white/14"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M6 6l12 12" />
            <path d="M18 6 6 18" />
          </svg>
        </button>

        <div className="relative">
          <p className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100">
            {content.eyebrow}
          </p>
          <h2
            id="auth-prompt-title"
            className="mt-4 max-w-xl text-3xl font-semibold leading-tight sm:text-4xl"
          >
            {content.title}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
            {content.description}
          </p>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {content.highlights.map((item) => (
              <article
                key={item.title}
                className="rounded-[1.35rem] border border-white/12 bg-white/8 p-4 backdrop-blur"
              >
                <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-xs leading-6 text-slate-300">{item.note}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/login"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#f6efe2]"
            >
              Log In
            </Link>
            <Link
              href="/login?mode=signup"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/16"
            >
              Create Account
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full border border-transparent px-5 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/10 hover:bg-white/8"
            >
              Continue Browsing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
