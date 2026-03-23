"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useReducer } from "react";

const WORKSPACE_ITEMS = [
  {
    href: "/writer",
    label: "Compose",
    description: "Draft, optimize, and publish from one workspace.",
    icon: "plus",
  },
  {
    href: "/writer/published",
    label: "Writer Portal",
    description: "Manage your profile and live articles.",
    icon: "dashboard",
  },
];

const SITE_ITEMS = [
  { href: "/blog", label: "Blog Home", icon: "home" },
  { href: "/categories", label: "Categories", icon: "folder" },
  { href: "/contact", label: "Contact", icon: "mail" },
  { href: "/about", label: "About", icon: "info" },
];

const initialDockState = {
  mounted: false,
  isAuthenticated: false,
  writerName: "Writer",
};

function dockStateReducer(state, action) {
  if (action.type === "mounted") {
    return {
      ...state,
      mounted: true,
    };
  }

  if (action.type === "sync_auth") {
    return {
      ...state,
      isAuthenticated: action.isAuthenticated,
      writerName: action.writerName || "Writer",
    };
  }

  if (action.type === "logged_out") {
    return {
      ...state,
      isAuthenticated: false,
      writerName: "Writer",
    };
  }

  return state;
}

function Icon({ name }) {
  if (name === "plus") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    );
  }

  if (name === "home") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    );
  }

  if (name === "dashboard") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    );
  }

  if (name === "folder") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    );
  }

  if (name === "mail") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    );
  }

  if (name === "info") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

function isLinkActive(pathname, href) {
  if (href === "/blog") {
    return pathname === "/blog" || pathname?.startsWith("/blog/");
  }
  return pathname === href || pathname?.startsWith(`${href}/`);
}

function NavItem({ item, pathname }) {
  const active = isLinkActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      className={`writer-dock-nav-item group flex items-start gap-3 rounded-2xl px-3.5 py-3 transition-all ${
        active
          ? "writer-dock-nav-item-active text-[#17352c]"
          : "text-slate-200 hover:text-white"
      }`}
    >
      <span
        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition ${
          active
            ? "bg-[#17352c] text-white"
            : "bg-white/5 text-slate-300 group-hover:bg-white/10 group-hover:text-white"
        }`}
      >
        <Icon name={item.icon} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{item.label}</span>
        {"description" in item && item.description ? (
          <span className={`mt-1 block text-xs leading-5 ${active ? "text-[#49645b]" : "text-slate-400"}`}>
            {item.description}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function getWorkspaceCopy(pathname) {
  if (pathname === "/writer") {
    return {
      label: "Composer",
      detail: "Shape headlines, assets, SEO, and publishing from one canvas.",
    };
  }

  if (pathname?.startsWith("/writer/published")) {
    return {
      label: "Portal",
      detail: "Tune your profile, review live stories, and keep the archive sharp.",
    };
  }

  return {
    label: "Workspace",
    detail: "Move between drafting and post management without leaving the studio.",
  };
}

export default function WriterDock() {
  const pathname = usePathname();
  const router = useRouter();
  const [dockState, dispatch] = useReducer(dockStateReducer, initialDockState);

  useEffect(() => {
    const syncAuth = () => {
      dispatch({
        type: "sync_auth",
        isAuthenticated: Boolean(localStorage.getItem("token")),
        writerName: localStorage.getItem("writer_username") || "Writer",
      });
    };

    dispatch({ type: "mounted" });
    syncAuth();
    window.addEventListener("storage", syncAuth);
    window.addEventListener("writer:profile-updated", syncAuth);
    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("writer:profile-updated", syncAuth);
    };
  }, []);

  useEffect(() => {
    if (!dockState.mounted) {
      return;
    }

    dispatch({
      type: "sync_auth",
      isAuthenticated: Boolean(localStorage.getItem("token")),
      writerName: localStorage.getItem("writer_username") || "Writer",
    });
  }, [dockState.mounted, pathname]);

  useEffect(() => {
    if (!dockState.mounted) {
      return;
    }

    const applyOffset = () => {
      const isDesktop = window.matchMedia("(min-width: 768px)").matches;
      const isSafePath = pathname.startsWith("/writer") && pathname !== "/writer/login";
      const isVisible = isDesktop && dockState.isAuthenticated && isSafePath;
      const offset = isVisible ? 256 : 0;
      document.documentElement.style.setProperty("--writer-dock-offset", `${offset}px`);
    };

    applyOffset();
    window.addEventListener("resize", applyOffset);

    return () => {
      window.removeEventListener("resize", applyOffset);
      document.documentElement.style.setProperty("--writer-dock-offset", "0px");
    };
  }, [dockState.mounted, dockState.isAuthenticated, pathname]);

  const isSafePath = pathname?.startsWith("/writer") && pathname !== "/writer/login";
  if (!dockState.mounted || !dockState.isAuthenticated || !isSafePath) {
    return null;
  }

  const writerName = dockState.writerName || "Writer";
  const writerInitials = writerName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "WR";
  const workspaceCopy = getWorkspaceCopy(pathname);

  return (
    <aside className="writer-dock-shell fixed inset-y-0 left-0 z-50 hidden w-64 flex-col text-white md:flex">
      <div className="flex h-16 items-center px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sm font-black tracking-[0.3em] text-[#17352c] shadow-[0_20px_35px_-22px_rgba(0,0,0,0.6)]">
            CB
          </span>
          <span>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">
              Editorial Suite
            </span>
            <span className="block text-lg font-semibold tracking-tight text-white">
              CorporateBlog
            </span>
          </span>
        </Link>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-4 pt-3">
        <div className="writer-dock-card rounded-[1.75rem] p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-black tracking-[0.18em] text-[#17352c]">
              {writerInitials}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
                Writer Session
              </p>
              <p className="truncate text-base font-semibold text-white">{writerName}</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">{workspaceCopy.detail}</p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/8 bg-black/10 px-3 py-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
                Current Space
              </p>
              <p className="text-sm font-semibold text-white">{workspaceCopy.label}</p>
            </div>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
              Live
            </span>
          </div>
        </div>

        <div className="mt-6">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-white/40">
            Workspace
          </p>
          <div className="mt-3 space-y-2">
            {WORKSPACE_ITEMS.map((item) => (
              <NavItem key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        </div>

        <div className="mt-6">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.26em] text-white/40">
            Quick Access
          </p>
          <div className="mt-3 grid gap-2">
            {SITE_ITEMS.map((item) => (
              <NavItem key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        </div>

        <div className="writer-dock-card mt-6 rounded-[1.5rem] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50">
            Studio Notes
          </p>
          <p className="mt-2 text-sm font-semibold text-white">
            Draft with structure, then tighten metadata before you hit publish.
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-300">
            The composer and portal now share the same editorial workspace styling for faster scanning.
          </p>
        </div>
      </div>

      <div className="px-4 pb-4 pt-2">
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem("token");
            localStorage.removeItem("writer_username");
            dispatch({ type: "logged_out" });
            router.push("/login");
          }}
          className="writer-dock-card flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-white transition hover:bg-white/12"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-sm font-black tracking-[0.15em] text-[#17352c]">
            {writerInitials[0]}
          </span>
          <span className="flex-1">
            <span className="block">Logout</span>
            <span className="block text-xs font-normal text-slate-300">End this writer session</span>
          </span>
        </button>
      </div>
    </aside>
  );
}
