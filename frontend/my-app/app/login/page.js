"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildApiUrl, getApiUnavailableMessage } from "../lib/apiConfig";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSignupMode = searchParams.get("mode") === "signup";
  const googleButtonRef = useRef(null);
  const googleButtonShellRef = useRef(null);
  const googleInitializedRef = useRef(false);
  const loginWithGoogleRef = useRef(null);

  const [hasSession, setHasSession] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleButtonWidth, setGoogleButtonWidth] = useState(320);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setHasSession(true);
    }
  }, []);

  const heroTitle = useMemo(
    () => (isSignupMode ? "Set up your writer access" : "Sign in to continue"),
    [isSignupMode]
  );

  const persistSession = useCallback(
    (payload, fallbackUsername = "") => {
      localStorage.setItem("token", payload.access);
      const resolvedUsername = payload?.user?.username || fallbackUsername;
      if (resolvedUsername) {
        localStorage.setItem("writer_username", resolvedUsername);
      }
      window.dispatchEvent(new Event("writer:profile-updated"));
      router.replace("/blog");
    },
    [router]
  );

  async function login(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(buildApiUrl("/login/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.access) {
        setError(data.detail || "Login failed");
        return;
      }

      persistSession(data, username);
    } catch {
      setError(getApiUnavailableMessage());
    } finally {
      setLoading(false);
    }
  }

  const loginWithGoogle = useCallback(
    async (credential) => {
      setError("");
      setGoogleLoading(true);

      try {
        const res = await fetch(buildApiUrl("/auth/google/"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            credential,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.access) {
          setError(data.detail || "Google login failed.");
          return;
        }

        persistSession(data);
      } catch {
        setError(getApiUnavailableMessage());
      } finally {
        setGoogleLoading(false);
      }
    },
    [persistSession]
  );

  useEffect(() => {
    loginWithGoogleRef.current = loginWithGoogle;
  }, [loginWithGoogle]);

  useEffect(() => {
    if (!googleButtonShellRef.current) {
      return;
    }

    const updateWidth = () => {
      const containerWidth = googleButtonShellRef.current?.clientWidth || 320;
      const nextWidth = Math.max(220, Math.min(360, Math.floor(containerWidth)));
      setGoogleButtonWidth(nextWidth);
    };

    updateWidth();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        updateWidth();
      });
      observer.observe(googleButtonShellRef.current);

      return () => {
        observer.disconnect();
      };
    }

    window.addEventListener("resize", updateWidth);
    return () => {
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) {
      return;
    }

    let cancelled = false;
    const setupGoogleButton = () => {
      if (cancelled || !googleButtonRef.current || !window.google?.accounts?.id) {
        return;
      }

      if (!googleInitializedRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: "popup",
          callback: async (response) => {
            if (!response?.credential) {
              setError("Google did not return a credential token.");
              return;
            }
            if (loginWithGoogleRef.current) {
              await loginWithGoogleRef.current(response.credential);
            }
          },
        });
        googleInitializedRef.current = true;
      }

      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "signin_with",
        width: googleButtonWidth,
      });
    };

    if (window.google?.accounts?.id) {
      setupGoogleButton();
      return () => {
        cancelled = true;
      };
    }

    const existingScript = document.querySelector('script[data-google-identity="true"]');
    if (existingScript) {
      existingScript.addEventListener("load", setupGoogleButton);
      return () => {
        cancelled = true;
        existingScript.removeEventListener("load", setupGoogleButton);
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "true";
    script.addEventListener("load", setupGoogleButton);
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.removeEventListener("load", setupGoogleButton);
    };
  }, [googleButtonWidth]);

  return (
    <main className="public-shell min-h-screen overflow-x-hidden px-4 py-8 sm:px-6 lg:px-8">
      <section className="public-panel mx-auto grid w-full min-w-0 max-w-6xl grid-cols-1 overflow-hidden rounded-[2rem] lg:grid-cols-[1fr_1.15fr]">
        <div className="order-2 min-w-0 public-panel-dark p-5 text-white sm:p-8 lg:order-1">
          <p className="inline-flex rounded-full bg-white/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
            Corporate Writer Desk
          </p>
          <h1 className="mt-4 break-words text-2xl font-semibold leading-tight sm:text-3xl">
            Create, structure, and publish blog posts with a focused workflow.
          </h1>
          <p className="mt-4 max-w-md break-words text-sm leading-7 text-cyan-50/90 sm:text-base">
            Sign in and open the blog home first, then use the writer side panel
            to launch dashboard tools, create posts, and manage publishing.
          </p>
          <ul className="mt-6 grid gap-3 text-sm text-cyan-50/90 sm:mt-8">
            <li className="rounded-xl border border-white/20 bg-white/10 px-3 py-2">
              Structured brief panel for audience and writing goals
            </li>
            <li className="rounded-xl border border-white/20 bg-white/10 px-3 py-2">
              Clean draft editor with quick actions and live status
            </li>
            <li className="rounded-xl border border-white/20 bg-white/10 px-3 py-2">
              Direct flow from login to the blog home and writer tools
            </li>
          </ul>
        </div>

        <div className="order-1 min-w-0 p-5 sm:p-8 lg:order-2">
          <p className="public-eyebrow">
            Login
          </p>
          <h2 className="mt-2 break-words text-2xl font-semibold text-slate-900 sm:text-3xl">{heroTitle}</h2>
          <p className="mt-2 break-words text-sm text-slate-600">
            {isSignupMode
              ? "You can continue with your current writer credentials."
              : "Use your writer credentials to access your studio."}
          </p>

          {hasSession && (
            <div className="mt-4 rounded-[1.25rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <p>Active session detected.</p>
              <button
                type="button"
                className="mt-2 font-semibold underline underline-offset-2"
                onClick={() => router.replace("/blog")}
              >
                Go to Blog Home
              </button>
            </div>
          )}

          <form className="mt-6 min-w-0 space-y-4 rounded-[1.5rem] border border-[rgba(20,44,38,0.08)] bg-white/72 p-4 sm:p-5" onSubmit={login}>
            <div>
              <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">
                Username
              </label>
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your username"
                autoComplete="username"
                className="public-input h-11 w-full rounded-[1.1rem] px-4 text-sm"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                type="password"
                autoComplete="current-password"
                className="public-input h-11 w-full rounded-[1.1rem] px-4 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading || googleLoading || !username.trim() || !password.trim()}
              className="public-button-primary inline-flex h-11 w-full items-center justify-center px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Logging in..." : "Continue to Blog"}
            </button>
          </form>

          <div className="mt-6">
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              or continue with
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            {!GOOGLE_CLIENT_ID ? (
              <p className="mt-3 break-words rounded-[1.1rem] border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in <code>.env.local</code> to enable Google sign-in.
              </p>
            ) : (
              <div className="mt-4 min-w-0 space-y-2">
                <div
                  ref={googleButtonShellRef}
                  className="min-w-0 overflow-hidden rounded-[1.2rem] border border-[rgba(20,44,38,0.08)] bg-white/72 p-2"
                >
                  <div ref={googleButtonRef} className="min-h-10 w-full overflow-hidden" />
                </div>
                {googleLoading && (
                  <p className="text-xs text-slate-500">Verifying your Google account...</p>
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="mt-4 rounded-[1.1rem] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap">
            <Link href="/blog" className="public-button-secondary px-4 py-2.5 text-center font-semibold">
              Back to Blog
            </Link>
            <Link href="/login?mode=signup" className="public-button-secondary px-4 py-2.5 text-center font-semibold">
              Need sign-up mode?
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
