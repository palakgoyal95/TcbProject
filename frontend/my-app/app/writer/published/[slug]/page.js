"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildApiUrl, getApiUnavailableMessage } from "../../../lib/apiConfig";
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 200);
}

function plainTextFromHtml(html) {
  return String(html || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildExcerpt(html, maxLength = 190) {
  const text = plainTextFromHtml(html);
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function sanitizeFileName(fileName) {
  return String(fileName || "image")
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .slice(0, 50);
}

function extractCloudinaryPublicIdFromUrl(url) {
  if (typeof url !== "string" || !url.trim()) {
    return "";
  }

  try {
    const parsed = new URL(url.trim());
    if (!parsed.hostname.includes("res.cloudinary.com")) {
      return "";
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    const uploadIndex = segments.findIndex((part) => part === "upload");
    if (uploadIndex < 0) {
      return "";
    }

    let publicIdParts = segments.slice(uploadIndex + 1);
    if (publicIdParts[0] && /^v\d+$/.test(publicIdParts[0])) {
      publicIdParts = publicIdParts.slice(1);
    }
    if (publicIdParts.length === 0) {
      return "";
    }

    const last = publicIdParts[publicIdParts.length - 1];
    publicIdParts[publicIdParts.length - 1] = last.replace(/\.[a-zA-Z0-9]+$/, "");
    return decodeURIComponent(publicIdParts.join("/"));
  } catch {
    return "";
  }
}

function extractApiErrorMessage(payload, fallbackStatusText = "") {
  const fallbackText = String(fallbackStatusText || "").trim();
  if (!payload) {
    return fallbackText;
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

  return messages.join(" | ") || fallbackText;
}

export default function WriterPublishedEditPage() {
  const router = useRouter();
  const params = useParams();
  const rawSlug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;
  const routeSlug = useMemo(() => {
    if (typeof rawSlug !== "string") {
      return "";
    }
    try {
      return decodeURIComponent(rawSlug);
    } catch {
      return rawSlug;
    }
  }, [rawSlug]);
  const coverImageInputRef = useRef(null);

  const [currentSlug, setCurrentSlug] = useState(routeSlug);
  const [writerSession, setWriterSession] = useState({
    id: null,
    username: "",
  });
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    title: "",
    slug: routeSlug,
    excerpt: "",
    content: "",
    category: "",
    status: "PUBLISHED",
    coverImageUrl: "",
    coverImagePublicId: "",
  });
  const [pageState, setPageState] = useState({
    isLoading: true,
    errorMessage: "",
  });
  const [submitState, setSubmitState] = useState({
    isSaving: false,
    successMessage: "",
    errorMessage: "",
  });
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  const cloudinaryReady = Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET);

  const wordCount = useMemo(() => {
    return plainTextFromHtml(form.content)
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean).length;
  }, [form.content]);

  const uploadToCloudinary = async (file, folderName) => {
    if (!cloudinaryReady) {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Session expired. Please log in again.");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", folderName);

      const response = await fetch(buildApiUrl("/uploads/images/"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.secure_url) {
        throw new Error(payload?.detail || "Image upload failed.");
      }

      return payload;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", folderName);
    formData.append("public_id", `${Date.now()}-${sanitizeFileName(file.name)}`);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.secure_url) {
      throw new Error(payload?.error?.message || "Cloudinary upload failed.");
    }

    return payload;
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }

    if (!routeSlug) {
      setPageState({
        isLoading: false,
        errorMessage: "Invalid post slug.",
      });
      return;
    }

    const initialize = async () => {
      setPageState({
        isLoading: true,
        errorMessage: "",
      });

      try {
        const [meResponse, categoriesResponse, postResponse] = await Promise.all([
          fetch(buildApiUrl("/me/"), {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }),
          fetch(buildApiUrl("/categories/"), { cache: "no-store" }),
          fetch(buildApiUrl(`/posts/${encodeURIComponent(routeSlug)}/`), { cache: "no-store" }),
        ]);

        const mePayload = await meResponse.json().catch(() => ({}));
        if (!meResponse.ok) {
          localStorage.removeItem("token");
          localStorage.removeItem("writer_username");
          router.replace("/login");
          return;
        }

        const resolvedUsername = String(mePayload?.username || "").trim();
        setWriterSession({
          id: mePayload?.id ?? null,
          username: resolvedUsername,
        });
        localStorage.setItem("writer_username", resolvedUsername);
        window.dispatchEvent(new Event("writer:profile-updated"));

        const categoriesPayload = await categoriesResponse.json().catch(() => []);
        const safeCategories = Array.isArray(categoriesPayload) ? categoriesPayload : [];
        setCategories(safeCategories);

        const postPayload = await postResponse.json().catch(() => ({}));

        if (!postResponse.ok || !postPayload?.slug) {
          setPageState({
            isLoading: false,
            errorMessage: "Could not load this published post.",
          });
          return;
        }

        if (postPayload?.author !== mePayload?.id) {
          setPageState({
            isLoading: false,
            errorMessage: "You can only edit posts you authored.",
          });
          return;
        }

        const loadedSlug = String(postPayload.slug || routeSlug);
        const loadedCategory = postPayload?.category != null ? String(postPayload.category) : "";

        setCurrentSlug(loadedSlug);
        setForm({
          title: String(postPayload?.title || ""),
          slug: loadedSlug,
          excerpt: String(postPayload?.excerpt || ""),
          content: String(postPayload?.content || ""),
          category:
            loadedCategory ||
            (safeCategories.length > 0 ? String(safeCategories[0]?.id || "") : ""),
          status: String(postPayload?.status || "PUBLISHED"),
          coverImageUrl: String(postPayload?.image_url || ""),
          coverImagePublicId: extractCloudinaryPublicIdFromUrl(String(postPayload?.image_url || "")),
        });

        setPageState({
          isLoading: false,
          errorMessage: "",
        });
      } catch {
        setPageState({
          isLoading: false,
          errorMessage: getApiUnavailableMessage(),
        });
      }
    };

    initialize();
  }, [routeSlug, router]);

  const handleCoverImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploadingCover(true);
    setSubmitState({
      isSaving: false,
      successMessage: "",
      errorMessage: "",
    });

    try {
      const uploaded = await uploadToCloudinary(file, "tcb-post-covers");
      setForm((previous) => ({
        ...previous,
        coverImageUrl: uploaded.secure_url || "",
        coverImagePublicId: uploaded.public_id || "",
      }));

      setSubmitState({
        isSaving: false,
        successMessage: "Cover image uploaded.",
        errorMessage: "",
      });
    } catch (error) {
      setSubmitState({
        isSaving: false,
        successMessage: "",
        errorMessage: error?.message || "Could not upload cover image.",
      });
    } finally {
      setIsUploadingCover(false);
      event.target.value = "";
    }
  };

  const savePost = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    const normalizedTitle = String(form.title || "").trim();
    const normalizedSlug = slugify(form.slug || form.title);
    const normalizedExcerpt = String(form.excerpt || "").trim() || buildExcerpt(form.content);
    const normalizedCategory = Number.parseInt(form.category || "", 10);

    if (!normalizedTitle) {
      setSubmitState({
        isSaving: false,
        successMessage: "",
        errorMessage: "Title is required.",
      });
      return;
    }

    if (!normalizedSlug) {
      setSubmitState({
        isSaving: false,
        successMessage: "",
        errorMessage: "Slug is required.",
      });
      return;
    }

    if (Number.isNaN(normalizedCategory)) {
      setSubmitState({
        isSaving: false,
        successMessage: "",
        errorMessage: "Category is required.",
      });
      return;
    }

    setSubmitState({
      isSaving: true,
      successMessage: "",
      errorMessage: "",
    });

    try {
      const response = await fetch(buildApiUrl(`/posts/${encodeURIComponent(currentSlug)}/`), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: normalizedTitle,
          slug: normalizedSlug,
          excerpt: normalizedExcerpt,
          content: form.content,
          category: normalizedCategory,
          status: form.status,
          image: form.coverImagePublicId || form.coverImageUrl || null,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setSubmitState({
          isSaving: false,
          successMessage: "",
          errorMessage: extractApiErrorMessage(
            payload,
            `Request failed with status ${response.status}.`
          ),
        });
        return;
      }

      const resolvedSlug = String(payload?.slug || normalizedSlug);
      const resolvedExcerpt = String(payload?.excerpt || normalizedExcerpt);
      const resolvedCoverUrl = String(payload?.image_url || form.coverImageUrl || "");

      setCurrentSlug(resolvedSlug);
      setForm((previous) => ({
        ...previous,
        slug: resolvedSlug,
        excerpt: resolvedExcerpt,
        coverImageUrl: resolvedCoverUrl,
        coverImagePublicId:
          extractCloudinaryPublicIdFromUrl(resolvedCoverUrl) || previous.coverImagePublicId,
      }));

      setSubmitState({
        isSaving: false,
        successMessage: "Published post updated.",
        errorMessage: "",
      });

      if (resolvedSlug !== routeSlug) {
        router.replace(`/writer/published/${encodeURIComponent(resolvedSlug)}`);
      }
    } catch {
      setSubmitState({
        isSaving: false,
        successMessage: "",
        errorMessage: getApiUnavailableMessage(),
      });
    }
  };

  if (pageState.isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-white px-4">
        <p className="text-sm font-medium text-slate-600">Loading published post editor...</p>
      </main>
    );
  }

  if (pageState.errorMessage) {
    return (
      <main className="min-h-screen bg-white px-4 py-6 sm:px-6 lg:px-8">
        <section className="mx-auto w-full max-w-3xl border border-slate-200 p-6">
          <h1 className="text-xl font-semibold text-slate-900">Cannot edit this post</h1>
          <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {pageState.errorMessage}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/writer/published"
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
            >
              Back To Writer Portal
            </Link>
            <Link
              href="/writer"
              className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open Writer
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-6 sm:px-6 lg:px-8">
      <input
        ref={coverImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverImageChange}
      />

      <section className="mx-auto grid w-full max-w-screen-xl grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-4 lg:border-r lg:border-slate-200 lg:pr-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Edit Published Post
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">{form.title || "Untitled Post"}</h1>
            <p className="mt-1 text-sm text-slate-600">
              Writer #{writerSession.id ?? "-"} - @{writerSession.username || "writer"}
            </p>
          </div>

          <div>
            <label
              htmlFor="edit-title"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Title
            </label>
            <input
              id="edit-title"
              value={form.title}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  title: event.target.value,
                }))
              }
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="edit-slug"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Slug
            </label>
            <input
              id="edit-slug"
              value={form.slug}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  slug: event.target.value,
                }))
              }
              maxLength={200}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="edit-excerpt"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Excerpt
            </label>
            <textarea
              id="edit-excerpt"
              rows={3}
              value={form.excerpt}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  excerpt: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() =>
                setForm((previous) => ({
                  ...previous,
                  excerpt: buildExcerpt(previous.content),
                }))
              }
              className="mt-1 text-xs font-semibold text-slate-600 underline underline-offset-2"
            >
              Auto-generate from content
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <label
                htmlFor="edit-category"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Category
              </label>
              <select
                id="edit-category"
                value={form.category}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    category: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-cyan-500 focus:outline-none"
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={String(category.id)}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="edit-status"
                className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Status
              </label>
              <select
                id="edit-status"
                value={form.status}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    status: event.target.value,
                  }))
                }
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-cyan-500 focus:outline-none"
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3">
            <label
              htmlFor="edit-cover-url"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Cover Image URL
            </label>
            <input
              id="edit-cover-url"
              value={form.coverImageUrl}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  coverImageUrl: event.target.value,
                  coverImagePublicId: event.target.value.trim()
                    ? ""
                    : previous.coverImagePublicId,
                }))
              }
              placeholder="https://..."
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-cyan-500 focus:outline-none"
            />

            <button
              type="button"
              onClick={() => coverImageInputRef.current?.click()}
              disabled={isUploadingCover}
              className="mt-2 inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-60"
            >
              {isUploadingCover ? "Uploading cover..." : "Upload to Cloudinary"}
            </button>

            {!cloudinaryReady && (
              <p className="mt-1 text-[11px] text-amber-700">
                Using secure backend upload because public Cloudinary vars are not set.
              </p>
            )}

            {form.coverImageUrl && (
              <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
                <Image
                  src={form.coverImageUrl}
                  alt="Cover preview"
                  width={640}
                  height={260}
                  className="h-36 w-full object-cover"
                />
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-3 text-sm text-slate-600">
            <p>Word count: {wordCount}</p>
            <p>Current slug: {currentSlug}</p>
          </div>
        </aside>

        <section className="border-l border-slate-200 pl-6">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Content Editor
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">Published Content</h2>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/writer/published"
                className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
              >
                Back To Portal
              </Link>
              <Link
                href={`/blog/${currentSlug}`}
                className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
              >
                View Live Post
              </Link>
              <button
                type="button"
                onClick={savePost}
                disabled={submitState.isSaving}
                className="inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {submitState.isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </header>

          {submitState.errorMessage && (
            <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {submitState.errorMessage}
            </p>
          )}

          {submitState.successMessage && (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {submitState.successMessage}
            </p>
          )}

          <div className="mt-4">
            <label
              htmlFor="edit-content"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Content (HTML supported)
            </label>
            <textarea
              id="edit-content"
              rows={24}
              value={form.content}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  content: event.target.value,
                }))
              }
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-mono text-sm leading-6 text-slate-800 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </section>
      </section>
    </main>
  );
}
