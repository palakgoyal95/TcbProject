"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useReducer, useState } from "react";

const WORKSPACE_ITEMS = [
  {
    href: "/writer",
    label: "Compose",
    description: "Draft and publish from one clean workspace.",
    icon: "plus",
  },
  {
    href: "/writer/published",
    label: "Writer Portal",
    description: "Review profile and published posts.",
    icon: "dashboard",
  },
];

const QUICK_LINK_ITEMS = [
  { href: "/blog", label: "Blog Home", icon: "home" },
  { href: "/categories", label: "Categories", icon: "folder" },
];

const DOCK_OPEN_STORAGE_KEY = "writer-dock-open";

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

  if (name === "chevron-left") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    );
  }

  if (name === "menu") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="17" x2="20" y2="17" />
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

function NavItem({ item, pathname, compact = false, onNavigate }) {
  const active = isLinkActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
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
        {!compact && "description" in item && item.description ? (
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
      detail: "Draft and publish from one focused space.",
    };
  }

  if (pathname?.startsWith("/writer/published")) {
    return {
      label: "Portal",
      detail: "Manage profile and published stories.",
    };
  }

  return {
    label: "Workspace",
    detail: "Move between composing and managing posts.",
  };
}

export default function WriterDock() {
  const pathname = usePathname();
  const router = useRouter();
  const [dockState, dispatch] = useReducer(dockStateReducer, initialDockState);
  const [isDockOpen, setIsDockOpen] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }

    const savedOpenState = localStorage.getItem(DOCK_OPEN_STORAGE_KEY);
    if (savedOpenState === "0") {
      return false;
    }
    if (savedOpenState === "1") {
      return true;
    }

    return window.matchMedia("(min-width: 768px)").matches;
  });
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia("(min-width: 768px)").matches;
  });

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

    localStorage.setItem(DOCK_OPEN_STORAGE_KEY, isDockOpen ? "1" : "0");
  }, [dockState.mounted, isDockOpen]);

  useEffect(() => {
    if (!dockState.mounted) {
      return;
    }

    const updateViewportState = () => {
      setIsDesktop(window.matchMedia("(min-width: 768px)").matches);
    };

    window.addEventListener("resize", updateViewportState);

    return () => {
      window.removeEventListener("resize", updateViewportState);
    };
  }, [dockState.mounted]);

  useEffect(() => {
    if (!dockState.mounted) {
      return;
    }

    const applyOffset = () => {
      const isSafePath = pathname.startsWith("/writer") && pathname !== "/writer/login";
      const isVisible = isDesktop && isDockOpen && dockState.isAuthenticated && isSafePath;
      const offset = isVisible ? 256 : 0;
      document.documentElement.style.setProperty("--writer-dock-offset", `${offset}px`);
    };

    applyOffset();
    window.addEventListener("resize", applyOffset);

    return () => {
      window.removeEventListener("resize", applyOffset);
      document.documentElement.style.setProperty("--writer-dock-offset", "0px");
    };
  }, [dockState.mounted, dockState.isAuthenticated, pathname, isDockOpen, isDesktop]);

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

  const handleHideDock = () => {
    setIsDockOpen(false);
  };

  const handleShowDock = () => {
    setIsDockOpen(true);
  };

  const handleNavClick = () => {
    if (!isDesktop) {
      setIsDockOpen(false);
    }
  };

  return (
    <>
      {!isDesktop && isDockOpen ? (
        <button
          type="button"
          aria-label="Close writer navigation overlay"
          onClick={handleHideDock}
          className="fixed inset-0 z-[59] bg-slate-950/45"
        />
      ) : null}

      <aside
        className={`writer-dock-shell fixed inset-y-0 left-0 z-[70] flex w-64 flex-col text-white transition-transform duration-200 ${
          isDockOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-3" onClick={handleNavClick}>
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-sm font-black tracking-[0.3em] text-[#17352c] shadow-[0_20px_35px_-22px_rgba(0,0,0,0.6)]">
              CB
            </span>
            <span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">
                Editorial Suite
              </span>
              <span className="block text-lg font-semibold tracking-tight text-white">
                CorporateBlog
              </span>
            </span>
          </Link>
          <button
            type="button"
            aria-label="Hide writer navigation"
            onClick={handleHideDock}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 bg-white/8 text-white transition hover:bg-white/16"
          >
            <Icon name="chevron-left" />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto px-4 pb-4 pt-3">
          <div className="writer-dock-card rounded-[1.6rem] border border-white/10 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-sm font-black tracking-[0.16em] text-[#17352c] shadow-[0_16px_28px_-22px_rgba(0,0,0,0.65)]">
                {writerInitials}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
                  Writer Session
                </p>
                <p className="truncate text-[1.4rem] font-semibold leading-tight text-white">{writerName}</p>
              </div>
            </div>

            <p className="mt-3 text-sm leading-7 text-slate-200/90">{workspaceCopy.detail}</p>

            <div className="mt-4 grid gap-2.5">
              <Link
                href="/writer/published"
                onClick={handleNavClick}
                className="inline-flex items-center gap-2 rounded-xl border border-white/14 bg-white/6 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:border-white/24 hover:bg-white/12"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/20 bg-white/10">
                  <Icon name="chevron-left" />
                </span>
                <span>Back to Dashboard</span>
              </Link>
              <div className="rounded-xl border border-white/10 bg-black/12 px-3.5 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                  Current Space
                </p>
                <p className="mt-1 text-[1.75rem] font-semibold leading-none text-white">{workspaceCopy.label}</p>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
              Workspace
            </p>
            <div className="mt-3 space-y-2">
              {WORKSPACE_ITEMS.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onNavigate={handleNavClick}
                />
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">
              Quick Access
            </p>
            <div className="mt-3 grid gap-2">
              {QUICK_LINK_ITEMS.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  compact
                  onNavigate={handleNavClick}
                />
              ))}
            </div>
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

      {isDockOpen ? null : (
        <div className="fixed bottom-4 left-4 z-[75] flex items-center gap-2">
          <button
            type="button"
            onClick={handleShowDock}
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(20,44,38,0.16)] bg-white px-4 py-2 text-sm font-semibold text-[#17352c] shadow-[0_14px_30px_-20px_rgba(18,33,29,0.6)] transition hover:bg-[#f5f7f6]"
          >
            <Icon name="menu" />
            Show Menu
          </button>
          <Link
            href="/writer/published"
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(20,44,38,0.16)] bg-white px-4 py-2 text-sm font-semibold text-[#17352c] shadow-[0_14px_30px_-20px_rgba(18,33,29,0.6)] transition hover:bg-[#f5f7f6]"
          >
            <Icon name="chevron-left" />
            Dashboard
          </Link>
        </div>
      )}
    </>
  );
}
