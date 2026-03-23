import Link from "next/link";
import TrendingNowWidget from "./TrendingNowWidget";
import { getPopularPosts } from "../lib/api";

const CHECKLIST_ITEMS = [
  {
    text: "Open with a clear business context and expected outcome.",
    tone: "border-cyan-200/80 bg-cyan-50/85",
    badge: "border-cyan-300 bg-white text-cyan-700",
  },
  {
    text: "Use headings that scan well for leadership readers.",
    tone: "border-sky-200/80 bg-sky-50/85",
    badge: "border-sky-300 bg-white text-sky-700",
  },
  {
    text: "Add one practical framework teams can apply this week.",
    tone: "border-emerald-200/80 bg-emerald-50/85",
    badge: "border-emerald-300 bg-white text-emerald-700",
  },
  {
    text: "Close with a measurable recommendation or next step.",
    tone: "border-amber-200/80 bg-amber-50/90",
    badge: "border-amber-300 bg-white text-amber-700",
  },
];

const SHORTCUTS = [
  {
    href: "/writer",
    label: "Open Writer Studio",
    note: "Create or publish a post",
    tone: "border-cyan-200/80 bg-[linear-gradient(180deg,#f1fbff_0%,#ffffff_100%)] hover:border-cyan-300 hover:bg-cyan-50/70",
    icon: "WS",
    iconTone: "bg-cyan-100 text-cyan-800",
  },
  {
    href: "/writer/published",
    label: "My Published Posts",
    note: "Review live articles",
    tone: "border-sky-200/80 bg-[linear-gradient(180deg,#f2f8ff_0%,#ffffff_100%)] hover:border-sky-300 hover:bg-sky-50/70",
    icon: "MP",
    iconTone: "bg-sky-100 text-sky-800",
  },
  {
    href: "/contact",
    label: "Contact Support",
    note: "Reach editorial and support teams",
    tone: "border-emerald-200/80 bg-[linear-gradient(180deg,#f2fff8_0%,#ffffff_100%)] hover:border-emerald-300 hover:bg-emerald-50/70",
    icon: "CS",
    iconTone: "bg-emerald-100 text-emerald-800",
  },
  {
    href: "/categories",
    label: "Category Map",
    note: "Check topic coverage",
    tone: "border-amber-200/80 bg-[linear-gradient(180deg,#fff9ef_0%,#ffffff_100%)] hover:border-amber-300 hover:bg-amber-50/70",
    icon: "CM",
    iconTone: "bg-amber-100 text-amber-800",
  },
];

export default async function Sidebar() {
  const popularPosts = await getPopularPosts(5);

  return (
    <aside className="min-w-0 space-y-6 lg:sticky lg:top-24">
      <section className="public-panel-dark relative overflow-hidden rounded-[1.9rem] p-6 text-white transition duration-300 hover:-translate-y-1">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-[rgba(190,116,63,0.18)] blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <span className="flex h-2 w-2 rounded-full bg-[#d5f2ea] shadow-[0_0_8px_rgba(213,242,234,0.7)]" />
            <p className="text-xs font-bold uppercase tracking-widest text-[#d5f2ea]">
              Editorial Briefing
            </p>
          </div>

          <h3 className="mt-4 break-words text-xl font-bold leading-snug text-white">
            Turn this feed into a daily{" "}
            <span className="bg-gradient-to-r from-[#f6efe2] to-[#d5f2ea] bg-clip-text text-transparent">
              decision memo
            </span>
            .
          </h3>

          <p className="mt-3 break-words text-sm font-medium leading-relaxed text-slate-300">
            Curated insights for leaders. Pick top posts, analyze implications, and drive strategy.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {["Strategy", "Operations", "Product", "Growth"].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/12 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#e8faf5] shadow-sm backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="public-panel-soft rounded-[1.9rem] p-6 transition duration-300 hover:-translate-y-1">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Review Checklist
          </p>
          <div className="ml-4 h-px flex-1 bg-slate-100"></div>
        </div>

        <ul className="space-y-3">
          {CHECKLIST_ITEMS.map((item, index) => (
            <li
              key={item.text}
              className={`group flex items-start gap-3 rounded-[1.25rem] border p-3 transition-all duration-200 hover:shadow-md ${item.tone.replace("bg-", "hover:bg-opacity-100 bg-opacity-60 ")}`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold shadow-sm ${item.badge}`}
              >
                {index + 1}
              </span>
              <span className="min-w-0 break-words text-sm font-medium leading-snug text-slate-700 group-hover:text-slate-900">
                {item.text}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="public-panel-soft rounded-[1.9rem] p-6 transition duration-300 hover:-translate-y-1">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Shortcuts
          </p>
          <div className="ml-4 h-px flex-1 bg-slate-100"></div>
        </div>

        <div className="space-y-3">
          {SHORTCUTS.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className={`group flex items-center gap-3 rounded-[1.25rem] border p-3 transition-all duration-200 hover:shadow-md ${shortcut.tone.replace("bg-", "hover:bg-opacity-100 bg-opacity-60 ")}`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold tracking-wider shadow-sm transition-transform group-hover:scale-105 ${shortcut.iconTone}`}
              >
                {shortcut.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 group-hover:text-slate-900">{shortcut.label}</p>
                <p className="truncate text-xs text-slate-500">{shortcut.note}</p>
              </div>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-slate-300 opacity-0 shadow-sm transition-all group-hover:opacity-100">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14" />
                  <path d="m15 15 3-3-3-3" />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <TrendingNowWidget posts={popularPosts} />
    </aside>
  );
}
