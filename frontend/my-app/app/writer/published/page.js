"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { buildApiUrl, getApiUnavailableMessage } from "../../lib/apiConfig";

function formatDate(dateValue) {
  const parsedDate = dateValue ? new Date(dateValue) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return "Unknown publish date";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsedDate);
}

function sortByNewest(posts) {
  return [...posts].sort(
    (left, right) =>
      new Date(right?.created_at || 0).getTime() -
      new Date(left?.created_at || 0).getTime()
  );
}

function extractApiErrorMessage(payload, fallbackMessage) {
  if (!payload) {
    return fallbackMessage;
  }

  if (typeof payload === "string") {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload.map((item) => String(item)).join(" ");
  }

  if (typeof payload.detail === "string") {
    return payload.detail;
  }

  const messages = Object.entries(payload)
    .map(([key, value]) => {
      if (typeof value === "string") {
        return `${key}: ${value}`;
      }
      if (Array.isArray(value)) {
        return `${key}: ${value.map((item) => String(item)).join(" ")}`;
      }
      return "";
    })
    .filter(Boolean);

  return messages.join(" | ") || fallbackMessage;
}

function PortalStat({ label, value, detail }) {
  return (
    <div className="writer-metric-tile rounded-[1.6rem] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-3 text-xl font-semibold text-slate-900">{value}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p>
    </div>
  );
}

export default function WriterPublishedPage() {
  const router = useRouter();
  const [profile, setProfile] = useState({
    id: null,
    username: "",
    about: "",
  });
  const [profileState, setProfileState] = useState({
    isLoading: true,
    isSaving: false,
    successMessage: "",
    errorMessage: "",
  });
  const [posts, setPosts] = useState([]);
  const [postsState, setPostsState] = useState({
    isLoading: true,
    isRefreshing: false,
    deletingSlug: "",
    successMessage: "",
    errorMessage: "",
  });

  const loadPostsForUsername = async (username, options = {}) => {
    const isRefreshing = Boolean(options.isRefreshing);
    const token = localStorage.getItem("token");

    setPostsState((previous) => ({
      ...previous,
      isLoading: !isRefreshing,
      isRefreshing,
      successMessage: "",
      errorMessage: "",
    }));

    try {
      const response = await fetch(
        buildApiUrl(`/authors/${encodeURIComponent(username)}/posts/`),
        {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : undefined,
          cache: "no-store",
        }
      );
      const payload = await response.json().catch(() => []);

      if (!response.ok || !Array.isArray(payload)) {
        setPosts([]);
        setPostsState({
          isLoading: false,
          isRefreshing: false,
          deletingSlug: "",
          successMessage: "",
          errorMessage: "Could not load your published posts.",
        });
        return;
      }

      setPosts(sortByNewest(payload));
      setPostsState({
        isLoading: false,
        isRefreshing: false,
        deletingSlug: "",
        successMessage: "",
        errorMessage: "",
      });
    } catch {
      setPosts([]);
      setPostsState({
        isLoading: false,
        isRefreshing: false,
        deletingSlug: "",
        successMessage: "",
        errorMessage: getApiUnavailableMessage(),
      });
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }

    const initialize = async () => {
      setProfileState({
        isLoading: true,
        isSaving: false,
        successMessage: "",
        errorMessage: "",
      });

      try {
        const meResponse = await fetch(buildApiUrl("/me/"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        const mePayload = await meResponse.json().catch(() => ({}));

        if (!meResponse.ok) {
          localStorage.removeItem("token");
          localStorage.removeItem("writer_username");
          router.replace("/login");
          return;
        }

        const resolvedUsername = String(mePayload?.username || "").trim();

        setProfile({
          id: mePayload?.id ?? null,
          username: resolvedUsername,
          about: String(mePayload?.about || ""),
        });

        localStorage.setItem("writer_username", resolvedUsername);
        window.dispatchEvent(new Event("writer:profile-updated"));

        setProfileState({
          isLoading: false,
          isSaving: false,
          successMessage: "",
          errorMessage: "",
        });

        if (resolvedUsername) {
          await loadPostsForUsername(resolvedUsername);
        } else {
          setPosts([]);
          setPostsState({
            isLoading: false,
            isRefreshing: false,
            deletingSlug: "",
            successMessage: "",
            errorMessage: "Writer username is missing.",
          });
        }
      } catch {
        setProfileState({
          isLoading: false,
          isSaving: false,
          successMessage: "",
          errorMessage: getApiUnavailableMessage(),
        });
        setPosts([]);
        setPostsState({
          isLoading: false,
          isRefreshing: false,
          deletingSlug: "",
          successMessage: "",
          errorMessage: getApiUnavailableMessage(),
        });
      }
    };

    initialize();
  }, [router]);

  const publishedCountLabel = useMemo(() => {
    const count = posts.length;
    return count === 1 ? "1 published post" : `${count} published posts`;
  }, [posts]);
  const latestPost = useMemo(() => (posts.length > 0 ? posts[0] : null), [posts]);
  const hasWriterBio = Boolean(String(profile.about || "").trim());
  const profilePreview = String(profile.about || "").trim();
  const portalStats = useMemo(
    () => [
      {
        label: "Published",
        value: posts.length.toString().padStart(2, "0"),
        detail: posts.length === 1 ? "Story live in the archive." : "Stories live in the archive.",
      },
      {
        label: "Latest",
        value: latestPost ? formatDate(latestPost?.created_at) : "No posts yet",
        detail: latestPost ? "Most recent publish date." : "Your next story will appear here.",
      },
      {
        label: "Profile",
        value: hasWriterBio ? "Ready" : "Needs bio",
        detail: hasWriterBio ? "Author intro is visible to readers." : "Add context so readers know your angle.",
      },
    ],
    [hasWriterBio, latestPost, posts.length]
  );

  const saveProfile = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const normalizedUsername = String(profile.username || "").trim();
    const normalizedAbout = String(profile.about || "").trim();

    if (!normalizedUsername) {
      setProfileState((previous) => ({
        ...previous,
        errorMessage: "Username cannot be empty.",
        successMessage: "",
      }));
      return;
    }

    setProfileState((previous) => ({
      ...previous,
      isSaving: true,
      errorMessage: "",
      successMessage: "",
    }));

    try {
      const response = await fetch(buildApiUrl("/me/"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: normalizedUsername,
          about: normalizedAbout,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setProfileState((previous) => ({
          ...previous,
          isSaving: false,
          errorMessage: extractApiErrorMessage(
            payload,
            `Request failed with status ${response.status}.`
          ),
          successMessage: "",
        }));
        return;
      }

      const resolvedUsername = String(payload?.username || normalizedUsername).trim();
      const resolvedAbout = String(payload?.about ?? normalizedAbout);

      setProfile({
        id: payload?.id ?? profile.id,
        username: resolvedUsername,
        about: resolvedAbout,
      });

      localStorage.setItem("writer_username", resolvedUsername);
      window.dispatchEvent(new Event("writer:profile-updated"));

      setProfileState((previous) => ({
        ...previous,
        isSaving: false,
        errorMessage: "",
        successMessage: "Profile updated.",
      }));

      await loadPostsForUsername(resolvedUsername, { isRefreshing: true });
    } catch {
      setProfileState((previous) => ({
        ...previous,
        isSaving: false,
        errorMessage: getApiUnavailableMessage(),
        successMessage: "",
      }));
    }
  };

  const refreshPosts = async () => {
    const username = String(profile.username || "").trim();
    if (!username) {
      return;
    }
    await loadPostsForUsername(username, { isRefreshing: true });
  };

  const deletePost = async (post) => {
    const slug = String(post?.slug || "").trim();
    const title = String(post?.title || "Untitled Post").trim();
    if (!slug) {
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const confirmed = window.confirm(`Delete post \"${title}\"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setPostsState((previous) => ({
      ...previous,
      deletingSlug: slug,
      successMessage: "",
      errorMessage: "",
    }));

    try {
      const response = await fetch(buildApiUrl(`/posts/${encodeURIComponent(slug)}/`), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        setPostsState((previous) => ({
          ...previous,
          deletingSlug: "",
          successMessage: "",
          errorMessage: extractApiErrorMessage(
            payload,
            `Delete failed with status ${response.status}.`
          ),
        }));
        return;
      }

      setPosts((previous) => previous.filter((item) => String(item?.slug || "") !== slug));
      setPostsState((previous) => ({
        ...previous,
        deletingSlug: "",
        successMessage: `Deleted \"${title}\".`,
        errorMessage: "",
      }));
    } catch {
      setPostsState((previous) => ({
        ...previous,
        deletingSlug: "",
        successMessage: "",
        errorMessage: getApiUnavailableMessage(),
      }));
    }
  };

  return (
    <main className="writer-shell min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-[1500px]">
        <header className="writer-card relative overflow-hidden rounded-[2rem] p-5 sm:p-8">
          <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(31,122,103,0.16),transparent_52%),radial-gradient(circle_at_top_right,rgba(190,116,63,0.18),transparent_42%)]" />
          <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.95fr)] xl:items-end">
            <div>
              <span className="writer-eyebrow">Writer Portal</span>
              <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Profile, publishing, and post management in one editorial home.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                {profile.username
                  ? `@${profile.username} is currently managing ${publishedCountLabel}. Keep your bio polished and your live stories easy to review.`
                  : `Manage ${publishedCountLabel}, keep your profile current, and jump back into drafting when you need a new story.`}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/writer"
                  className="inline-flex h-11 items-center rounded-full bg-[#17352c] px-5 text-sm font-semibold text-white transition hover:bg-[#10251f]"
                >
                  Create New Post
                </Link>
                <Link
                  href="/blog"
                  className="inline-flex h-11 items-center rounded-full border border-[rgba(20,44,38,0.12)] bg-white/80 px-5 text-sm font-semibold text-slate-700 transition hover:border-[rgba(20,44,38,0.2)] hover:bg-white"
                >
                  Open Blog
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              {portalStats.map((item) => (
                <PortalStat
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  detail={item.detail}
                />
              ))}
            </div>
          </div>
        </header>

        <section className="mt-6 grid w-full grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
            {profileState.errorMessage && (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {profileState.errorMessage}
              </p>
            )}
            {profileState.successMessage && (
              <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {profileState.successMessage}
              </p>
            )}

            <div className="writer-card-soft rounded-[1.75rem] p-5">
              <div className="flex items-start gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.35rem] bg-[#17352c] text-base font-black tracking-[0.18em] text-white">
                  {(profile.username || "WR")
                    .split(" ")
                    .filter(Boolean)
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "WR"}
                </span>
                <div className="min-w-0">
                  <span className="writer-pill">Writer Profile</span>
                  <p className="mt-3 text-lg font-semibold text-slate-900">
                    {profile.username ? `@${profile.username}` : "Profile pending"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {profilePreview || "Add a writer bio so the portal carries your voice as strongly as your articles do."}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <div>
                  <label
                    htmlFor="writer-portal-user-id"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                  >
                    User ID
                  </label>
                  <input
                    id="writer-portal-user-id"
                    value={profile.id ?? "Not synced"}
                    disabled
                    suppressHydrationWarning
                    className="h-11 w-full rounded-2xl border border-[rgba(20,44,38,0.12)] bg-white/80 px-4 text-sm text-slate-700"
                  />
                </div>
                <div>
                  <label
                    htmlFor="writer-portal-username"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                  >
                    Username
                  </label>
                  <input
                    id="writer-portal-username"
                    value={profile.username}
                    onChange={(event) =>
                      setProfile((previous) => ({
                        ...previous,
                        username: event.target.value,
                      }))
                    }
                    suppressHydrationWarning
                    className="h-11 w-full rounded-2xl border border-[rgba(20,44,38,0.12)] bg-white/90 px-4 text-sm text-slate-700 focus:border-[#1f7a67] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="writer-portal-about"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                  >
                    About Writer
                  </label>
                  <textarea
                    id="writer-portal-about"
                    rows={5}
                    value={profile.about}
                    onChange={(event) =>
                      setProfile((previous) => ({
                        ...previous,
                        about: event.target.value,
                      }))
                    }
                    placeholder="Tell readers about this writer..."
                    suppressHydrationWarning
                    className="w-full rounded-[1.4rem] border border-[rgba(20,44,38,0.12)] bg-white/90 px-4 py-3 text-sm leading-6 text-slate-700 focus:border-[#1f7a67] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="writer-card-soft rounded-[1.75rem] p-5">
              <span className="writer-pill">Actions</span>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Keep your public author profile fresh and refresh the archive whenever you need the latest live state.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={profileState.isSaving || profileState.isLoading}
                  className="inline-flex h-11 items-center rounded-full bg-[#17352c] px-5 text-sm font-semibold text-white transition hover:bg-[#10251f] disabled:opacity-60"
                >
                  {profileState.isSaving ? "Saving..." : "Save Profile"}
                </button>
                <button
                  type="button"
                  onClick={refreshPosts}
                  disabled={postsState.isRefreshing || postsState.isLoading || !profile.username}
                  className="inline-flex h-11 items-center rounded-full border border-[rgba(20,44,38,0.12)] bg-white/80 px-5 text-sm font-semibold text-slate-700 transition hover:border-[rgba(20,44,38,0.2)] hover:bg-white disabled:opacity-60"
                >
                  {postsState.isRefreshing ? "Refreshing..." : "Refresh Posts"}
                </button>
              </div>
            </div>
          </aside>

          <section>
            <div className="writer-card-soft rounded-[1.75rem] p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="writer-eyebrow">Published Library</span>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-900">Live stories and quick actions</h2>
                </div>
                <span className="writer-pill">{publishedCountLabel}</span>
              </div>

              {postsState.isLoading && (
                <p className="mt-5 text-sm text-slate-600">Loading your published posts...</p>
              )}
              {!postsState.isLoading && postsState.errorMessage && (
                <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {postsState.errorMessage}
                </p>
              )}
              {!postsState.isLoading && postsState.successMessage && (
                <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {postsState.successMessage}
                </p>
              )}

              {!postsState.isLoading && !postsState.errorMessage && posts.length === 0 && (
                <div className="mt-5 rounded-[1.65rem] border border-dashed border-[rgba(20,44,38,0.2)] bg-white/70 px-6 py-10 text-center">
                  <h3 className="text-xl font-semibold text-slate-900">No published posts yet</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Publish your first post from the writer composer and it will show up here with edit and review actions.
                  </p>
                  <Link
                    href="/writer"
                    className="mt-5 inline-flex items-center rounded-full bg-[#17352c] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#10251f]"
                  >
                    Create And Publish
                  </Link>
                </div>
              )}

              {!postsState.isLoading && !postsState.errorMessage && posts.length > 0 && (
                <div className="mt-6 grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
                  {posts.map((post) => (
                    <article
                      key={post?.id || post?.slug}
                      className="writer-card group overflow-hidden rounded-[1.75rem] transition duration-200 hover:-translate-y-1"
                    >
                      <div className="relative">
                        {post?.image_url ? (
                          <div className="relative h-44 overflow-hidden">
                            <Image
                              src={post.image_url}
                              alt={post?.title || "Published post cover"}
                              fill
                              sizes="(max-width: 1024px) 100vw, (max-width: 1536px) 50vw, 33vw"
                              className="object-cover transition duration-500 group-hover:scale-[1.03]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent" />
                          </div>
                        ) : (
                          <div className="flex h-44 items-end bg-[linear-gradient(135deg,rgba(31,122,103,0.18),rgba(190,116,63,0.18))] p-5">
                            <span className="rounded-full border border-white/60 bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700">
                              {post?.slug || "Draft"}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="writer-pill">Published {formatDate(post?.created_at)}</span>
                          {post?.slug ? (
                            <span className="rounded-full border border-[rgba(20,44,38,0.08)] bg-[rgba(31,122,103,0.08)] px-3 py-1 text-[11px] font-semibold text-[#1f7a67]">
                              /{post.slug}
                            </span>
                          ) : null}
                        </div>

                        <h3 className="mt-4 text-xl font-semibold tracking-tight text-slate-900 transition group-hover:text-[#1f7a67]">
                          {post?.title || "Untitled Post"}
                        </h3>
                        <p className="mt-3 text-sm leading-7 text-slate-600">
                          {post?.excerpt || "No excerpt available."}
                        </p>

                        <div className="mt-6 flex flex-wrap gap-2">
                          <Link
                            href={`/blog/${post?.slug}`}
                            className="inline-flex items-center rounded-full bg-[#17352c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#10251f]"
                          >
                            View Post
                          </Link>
                          <Link
                            href={`/writer/published/${encodeURIComponent(post?.slug || "")}`}
                            className="inline-flex items-center rounded-full border border-[rgba(20,44,38,0.12)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[rgba(20,44,38,0.2)]"
                          >
                            Edit Published
                          </Link>
                          <button
                            type="button"
                            onClick={() => deletePost(post)}
                            disabled={postsState.deletingSlug === String(post?.slug || "")}
                            className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {postsState.deletingSlug === String(post?.slug || "")
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}
