"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { trackPublishEvent } from "../lib/analytics";
import { buildApiUrl, getApiUnavailableMessage } from "../lib/apiConfig";
const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

const INITIAL_EDITOR_HTML = `
<h1>Design Diaries: Navigating the UI/UX World with Creativity and Strategy</h1>
<p>Start with a strong opening paragraph that explains the business context, audience, and why this post matters now.</p>
<h2>Why This Topic Matters</h2>
<p>Show the practical impact for teams and decision-makers.</p>
<h2>A Framework Readers Can Apply</h2>
<p>Give a repeatable method with clear steps.</p>
`;

const initialSession = {
  isCheckingAuth: true,
  isAuthorized: false,
  writerName: "Writer",
};

function sessionReducer(state, action) {
  if (action.type === "authorized") {
    return {
      isCheckingAuth: false,
      isAuthorized: true,
      writerName: action.writerName || "Writer",
    };
  }

  if (action.type === "unauthorized") {
    return {
      isCheckingAuth: false,
      isAuthorized: false,
      writerName: "Writer",
    };
  }

  return state;
}

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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  if (
    fallbackText &&
    (fallbackText.includes("<!DOCTYPE html") ||
      fallbackText.includes("<html") ||
      fallbackText.includes("<title>DataError"))
  ) {
    return "Server returned an HTML DataError page. Run backend migrations or reduce long field values.";
  }

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
      if (value && typeof value === "object") {
        const nested = Object.values(value).flat().map((item) => String(item)).join(" ");
        return nested ? `${key}: ${nested}` : "";
      }
      return "";
    })
    .filter(Boolean);

  return messages.join(" | ") || fallbackText;
}

function toLocalDateTimeInputValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (input) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeFaqBlocksForSave(faqBlocks) {
  if (!Array.isArray(faqBlocks)) {
    return [];
  }

  return faqBlocks
    .map((item) => ({
      question: String(item?.question || "").trim(),
      answer: String(item?.answer || "").trim(),
    }))
    .filter((item) => item.question && item.answer)
    .slice(0, 12);
}

function ToolbarButton({ title, onClick, disabled, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-[rgba(20,44,38,0.12)] bg-white/90 px-3 text-slate-700 shadow-[0_16px_24px_-22px_rgba(18,33,29,0.55)] transition hover:border-[rgba(31,122,103,0.25)] hover:bg-white disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export default function WriterPage() {
  const router = useRouter();
  const editorRef = useRef(null);
  const coverImageInputRef = useRef(null);
  const inlineImageInputRef = useRef(null);
  const savedRangeRef = useRef(null);

  const [session, dispatch] = useReducer(sessionReducer, initialSession);
  const [categories, setCategories] = useState([]);

  const [title, setTitle] = useState("Essential Tips for Creating Engaging Digital Experiences");
  const [slug, setSlug] = useState("essential-tips-for-creating-engaging-digital-experiences");
  const [isSlugCustom, setIsSlugCustom] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [scheduledFor, setScheduledFor] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");

  const [seoNoindex, setSeoNoindex] = useState(false);
  const [isSponsored, setIsSponsored] = useState(false);
  const [disclosureText, setDisclosureText] = useState("");
  const [premiumEnabled, setPremiumEnabled] = useState(false);
  const [adSlotTopEnabled, setAdSlotTopEnabled] = useState(false);
  const [adSlotInlineEnabled, setAdSlotInlineEnabled] = useState(false);
  const [adSlotSidebarEnabled, setAdSlotSidebarEnabled] = useState(false);
  const [editorialCapabilities, setEditorialCapabilities] = useState({
    canSchedulePosts: false,
    canManageAllPosts: false,
  });
  const [faqBlocks, setFaqBlocks] = useState([
    {
      question: "",
      answer: "",
    },
  ]);

  const [editorHtml, setEditorHtml] = useState(INITIAL_EDITOR_HTML);

  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImagePublicId, setCoverImagePublicId] = useState("");
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingInlineImage, setIsUploadingInlineImage] = useState(false);

  const [submitState, setSubmitState] = useState({
    isSubmitting: false,
    successMessage: "",
    errorMessage: "",
  });
  const [backendAutosaveState, setBackendAutosaveState] = useState({
    isSaving: false,
    lastSavedAt: "",
  });
  const [lastPublishedSlug, setLastPublishedSlug] = useState("");
  const [linkSuggestionState, setLinkSuggestionState] = useState({
    postId: null,
    suggestions: [],
    isLoading: false,
    errorMessage: "",
    lastSyncedAt: "",
  });

  const cloudinaryReady = Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET);
  const autosaveReadyRef = useRef(false);

  const wordCount = useMemo(() => {
    return plainTextFromHtml(editorHtml)
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean).length;
  }, [editorHtml]);

  const readingTime = Math.max(1, Math.ceil(wordCount / 220));
  const publishLimit = 800;
  const publishProgress = Math.min(100, Math.round((wordCount / publishLimit) * 100));
  const wordsRemainingForPublish = Math.max(0, publishLimit - wordCount);
  const headingCount = useMemo(
    () => (String(editorHtml || "").match(/<h[2-3][^>]*>/gi) || []).length,
    [editorHtml]
  );
  const internalLinkCount = useMemo(
    () => (String(editorHtml || "").match(/href=["']\/blog\//gi) || []).length,
    [editorHtml]
  );
  const normalizedFaqBlocks = useMemo(
    () => normalizeFaqBlocksForSave(faqBlocks),
    [faqBlocks]
  );
  const seoScoreDetails = useMemo(() => {
    const checks = [
      {
        id: "title_length",
        label: "Title length 40-65 chars",
        passed: title.trim().length >= 40 && title.trim().length <= 65,
        weight: 20,
      },
      {
        id: "excerpt_length",
        label: "Excerpt length 110-170 chars",
        passed: excerpt.trim().length >= 110 && excerpt.trim().length <= 170,
        weight: 15,
      },
      {
        id: "word_count",
        label: "Body length 600-1200 words",
        passed: wordCount >= 600 && wordCount <= 1200,
        weight: 20,
      },
      {
        id: "headings",
        label: "At least 2 subheadings (H2/H3)",
        passed: headingCount >= 2,
        weight: 15,
      },
      {
        id: "internal_links",
        label: "At least 2 internal links",
        passed: internalLinkCount >= 2,
        weight: 15,
      },
      {
        id: "faq",
        label: "At least 2 FAQ entries",
        passed: normalizedFaqBlocks.length >= 2,
        weight: 10,
      },
      {
        id: "cover_image",
        label: "Cover image configured",
        passed: Boolean(
          String(coverImageUrl || "").trim() || String(coverImagePublicId || "").trim()
        ),
        weight: 5,
      },
    ];

    const score = checks.reduce(
      (sum, check) => (check.passed ? sum + check.weight : sum),
      0
    );

    return {
      checks,
      score,
    };
  }, [
    title,
    excerpt,
    wordCount,
    headingCount,
    internalLinkCount,
    normalizedFaqBlocks.length,
    coverImageUrl,
    coverImagePublicId,
  ]);
  const slugPreview = `/blog/${slugify(slug || title) || ""}`;
  const seoPreviewTitle = (seoTitle.trim() || title.trim() || "Untitled article").slice(0, 70);
  const seoPreviewDescription = (
    seoDescription.trim() ||
    excerpt.trim() ||
    buildExcerpt(editorHtml, 160)
  ).slice(0, 170);
  const writerInitials = String(session.writerName || "Writer")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "WR";
  const autosaveLabel = backendAutosaveState.isSaving
    ? "Syncing draft"
    : backendAutosaveState.lastSavedAt
      ? `Saved ${backendAutosaveState.lastSavedAt}`
      : "Autosave ready";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      dispatch({ type: "unauthorized" });
      return;
    }

    const cachedWriterName = localStorage.getItem("writer_username") || "Writer";
    dispatch({ type: "authorized", writerName: cachedWriterName });

    const initialize = async () => {
      try {
        const meResponse = await fetch(buildApiUrl("/me/"), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        if (meResponse.ok) {
          const mePayload = await meResponse.json();
          const resolvedWriterName = mePayload?.username || cachedWriterName;
          dispatch({ type: "authorized", writerName: resolvedWriterName });
          localStorage.setItem("writer_username", resolvedWriterName);
          setEditorialCapabilities({
            canSchedulePosts: Boolean(
              mePayload?.capabilities?.can_schedule_posts ??
                mePayload?.capabilities?.canSchedulePosts
            ),
            canManageAllPosts: Boolean(
              mePayload?.capabilities?.can_manage_all_posts ??
                mePayload?.capabilities?.canManageAllPosts
            ),
          });
        }
      } catch {}

      try {
        const categoryResponse = await fetch(buildApiUrl("/categories/"));
        const categoryPayload = await categoryResponse.json();

        if (Array.isArray(categoryPayload)) {
          setCategories(categoryPayload);
          setSelectedCategory((current) =>
            !current && categoryPayload.length > 0 ? String(categoryPayload[0].id) : current
          );
        }
      } catch {
        setCategories([]);
      }

      let localDraftUpdatedAt = "";
      try {
        const draftRaw = localStorage.getItem("writer_draft_v2");
        if (!draftRaw) {
          setExcerpt((current) => current || buildExcerpt(INITIAL_EDITOR_HTML));
        } else {
          const draft = JSON.parse(draftRaw);
          localDraftUpdatedAt =
            typeof draft.updatedAt === "string" ? draft.updatedAt : "";

          if (typeof draft.title === "string") {
            setTitle(draft.title);
          }
          if (typeof draft.slug === "string") {
            setSlug(draft.slug);
          }
          if (typeof draft.isSlugCustom === "boolean") {
            setIsSlugCustom(draft.isSlugCustom);
          }
          if (typeof draft.excerpt === "string") {
            setExcerpt(draft.excerpt);
          }
          if (typeof draft.selectedCategory === "string") {
            setSelectedCategory(draft.selectedCategory);
          }
          if (typeof draft.status === "string") {
            setStatus(draft.status);
          }
          if (typeof draft.scheduledFor === "string") {
            setScheduledFor(draft.scheduledFor);
          }
          if (typeof draft.seoTitle === "string") {
            setSeoTitle(draft.seoTitle);
          }
          if (typeof draft.seoDescription === "string") {
            setSeoDescription(draft.seoDescription);
          }
          if (typeof draft.canonicalUrl === "string") {
            setCanonicalUrl(draft.canonicalUrl);
          }
          if (typeof draft.seoNoindex === "boolean") {
            setSeoNoindex(draft.seoNoindex);
          }
          if (typeof draft.isSponsored === "boolean") {
            setIsSponsored(draft.isSponsored);
          }
          if (typeof draft.disclosureText === "string") {
            setDisclosureText(draft.disclosureText);
          }
          if (typeof draft.premiumEnabled === "boolean") {
            setPremiumEnabled(draft.premiumEnabled);
          }
          if (typeof draft.adSlotTopEnabled === "boolean") {
            setAdSlotTopEnabled(draft.adSlotTopEnabled);
          }
          if (typeof draft.adSlotInlineEnabled === "boolean") {
            setAdSlotInlineEnabled(draft.adSlotInlineEnabled);
          }
          if (typeof draft.adSlotSidebarEnabled === "boolean") {
            setAdSlotSidebarEnabled(draft.adSlotSidebarEnabled);
          }
          if (typeof draft.editorHtml === "string") {
            setEditorHtml(draft.editorHtml);
          }
          if (typeof draft.coverImageUrl === "string") {
            setCoverImageUrl(draft.coverImageUrl);
          }
          if (typeof draft.coverImagePublicId === "string") {
            setCoverImagePublicId(draft.coverImagePublicId);
          }
          if (Array.isArray(draft.faqBlocks)) {
            const restoredFaqBlocks = draft.faqBlocks
              .map((item) => ({
                question: typeof item?.question === "string" ? item.question : "",
                answer: typeof item?.answer === "string" ? item.answer : "",
              }))
              .slice(0, 12);

            if (restoredFaqBlocks.length > 0) {
              setFaqBlocks(restoredFaqBlocks);
            }
          }
          if (draft?.suggestionPostId != null) {
            const parsedSuggestionPostId = Number.parseInt(
              String(draft.suggestionPostId),
              10
            );
            if (!Number.isNaN(parsedSuggestionPostId)) {
              setLinkSuggestionState((previous) => ({
                ...previous,
                postId: parsedSuggestionPostId,
              }));
            }
          }
        }
      } catch {
        setExcerpt((current) => current || buildExcerpt(INITIAL_EDITOR_HTML));
      }

      try {
        const autosaveResponse = await fetch(
          buildApiUrl("/editorial/autosave/?draft_key=new-post"),
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        if (autosaveResponse.ok) {
          const autosavePayload = await autosaveResponse.json();
          const remoteUpdatedAt = String(autosavePayload?.updated_at || "");
          const shouldHydrateRemote =
            Boolean(autosavePayload?.payload) &&
            (!localDraftUpdatedAt ||
              (remoteUpdatedAt &&
                new Date(remoteUpdatedAt).getTime() >
                  new Date(localDraftUpdatedAt).getTime()));

          if (shouldHydrateRemote) {
            const remoteDraft = autosavePayload.payload;
            if (typeof remoteDraft.title === "string") {
              setTitle(remoteDraft.title);
            }
            if (typeof remoteDraft.slug === "string") {
              setSlug(remoteDraft.slug);
            }
            if (typeof remoteDraft.excerpt === "string") {
              setExcerpt(remoteDraft.excerpt);
            }
            if (typeof remoteDraft.selectedCategory === "string") {
              setSelectedCategory(remoteDraft.selectedCategory);
            }
            if (typeof remoteDraft.status === "string") {
              setStatus(remoteDraft.status);
            }
            if (typeof remoteDraft.scheduledFor === "string") {
              setScheduledFor(remoteDraft.scheduledFor);
            }
            if (typeof remoteDraft.seoTitle === "string") {
              setSeoTitle(remoteDraft.seoTitle);
            }
            if (typeof remoteDraft.seoDescription === "string") {
              setSeoDescription(remoteDraft.seoDescription);
            }
            if (typeof remoteDraft.canonicalUrl === "string") {
              setCanonicalUrl(remoteDraft.canonicalUrl);
            }
            if (typeof remoteDraft.editorHtml === "string") {
              setEditorHtml(remoteDraft.editorHtml);
            }
            if (typeof remoteDraft.seoNoindex === "boolean") {
              setSeoNoindex(remoteDraft.seoNoindex);
            }
            if (typeof remoteDraft.isSponsored === "boolean") {
              setIsSponsored(remoteDraft.isSponsored);
            }
            if (typeof remoteDraft.disclosureText === "string") {
              setDisclosureText(remoteDraft.disclosureText);
            }
            if (typeof remoteDraft.premiumEnabled === "boolean") {
              setPremiumEnabled(remoteDraft.premiumEnabled);
            }
            if (typeof remoteDraft.adSlotTopEnabled === "boolean") {
              setAdSlotTopEnabled(remoteDraft.adSlotTopEnabled);
            }
            if (typeof remoteDraft.adSlotInlineEnabled === "boolean") {
              setAdSlotInlineEnabled(remoteDraft.adSlotInlineEnabled);
            }
            if (typeof remoteDraft.adSlotSidebarEnabled === "boolean") {
              setAdSlotSidebarEnabled(remoteDraft.adSlotSidebarEnabled);
            }
            if (typeof remoteDraft.coverImageUrl === "string") {
              setCoverImageUrl(remoteDraft.coverImageUrl);
            }
            if (typeof remoteDraft.coverImagePublicId === "string") {
              setCoverImagePublicId(remoteDraft.coverImagePublicId);
            }
            if (Array.isArray(remoteDraft.faqBlocks) && remoteDraft.faqBlocks.length > 0) {
              setFaqBlocks(remoteDraft.faqBlocks);
            }
          }
        }
      } catch {}

      autosaveReadyRef.current = true;
    };

    initialize();
  }, [router]);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== editorHtml) {
      editorRef.current.innerHTML = editorHtml;
    }
  }, [editorHtml]);

  const saveSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) {
      return;
    }

    savedRangeRef.current = range;
  };

  const restoreSelection = () => {
    if (!savedRangeRef.current) {
      return;
    }

    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    selection.removeAllRanges();
    selection.addRange(savedRangeRef.current);
  };

  const syncEditorHtmlFromDom = () => {
    const html = editorRef.current?.innerHTML || "";
    setEditorHtml(html);
  };

  const runCommand = (command, value = null) => {
    if (!editorRef.current) {
      return false;
    }

    editorRef.current.focus();
    restoreSelection();
    const success = document.execCommand(command, false, value);
    syncEditorHtmlFromDom();
    saveSelection();
    return success;
  };

  const runListCommand = (type) => {
    const command = type === "ordered" ? "insertOrderedList" : "insertUnorderedList";
    const success = runCommand(command);

    if (!success) {
      const fallbackTag = type === "ordered" ? "ol" : "ul";
      runCommand(
        "insertHTML",
        `<${fallbackTag}><li>List item</li></${fallbackTag}><p></p>`
      );
    }
  };

  const openLinkPrompt = () => {
    const url = window.prompt("Enter URL");
    if (url) {
      runCommand("createLink", url);
    }
  };

  const handleTitleChange = (event) => {
    const nextTitle = event.target.value;
    setTitle(nextTitle);

    if (!isSlugCustom) {
      setSlug(slugify(nextTitle));
    }
  };

  const persistLocalDraft = useCallback((overrides = {}, options = {}) => {
    const updatedAt = new Date().toISOString();
    localStorage.setItem(
      "writer_draft_v2",
      JSON.stringify({
        title: overrides.title ?? title,
        slug: overrides.slug ?? slug,
        isSlugCustom: overrides.isSlugCustom ?? isSlugCustom,
        excerpt: overrides.excerpt ?? excerpt,
        selectedCategory: overrides.selectedCategory ?? selectedCategory,
        status: overrides.status ?? status,
        scheduledFor: overrides.scheduledFor ?? scheduledFor,
        seoTitle: overrides.seoTitle ?? seoTitle,
        seoDescription: overrides.seoDescription ?? seoDescription,
        canonicalUrl: overrides.canonicalUrl ?? canonicalUrl,
        seoNoindex: overrides.seoNoindex ?? seoNoindex,
        isSponsored: overrides.isSponsored ?? isSponsored,
        disclosureText: overrides.disclosureText ?? disclosureText,
        premiumEnabled: overrides.premiumEnabled ?? premiumEnabled,
        adSlotTopEnabled: overrides.adSlotTopEnabled ?? adSlotTopEnabled,
        adSlotInlineEnabled: overrides.adSlotInlineEnabled ?? adSlotInlineEnabled,
        adSlotSidebarEnabled: overrides.adSlotSidebarEnabled ?? adSlotSidebarEnabled,
        faqBlocks: overrides.faqBlocks ?? faqBlocks,
        editorHtml: overrides.editorHtml ?? editorHtml,
        coverImageUrl: overrides.coverImageUrl ?? coverImageUrl,
        coverImagePublicId: overrides.coverImagePublicId ?? coverImagePublicId,
        suggestionPostId: overrides.suggestionPostId ?? linkSuggestionState.postId,
        updatedAt,
      })
    );

    if (!options.silent) {
      setSubmitState((previous) => ({
        ...previous,
        successMessage: `Draft saved locally at ${new Date().toLocaleTimeString()}`,
        errorMessage: "",
      }));
    }
  }, [
    title,
    slug,
    isSlugCustom,
    excerpt,
    selectedCategory,
    status,
    scheduledFor,
    seoTitle,
    seoDescription,
    canonicalUrl,
    seoNoindex,
    isSponsored,
    disclosureText,
    premiumEnabled,
    adSlotTopEnabled,
    adSlotInlineEnabled,
    adSlotSidebarEnabled,
    faqBlocks,
    editorHtml,
    coverImageUrl,
    coverImagePublicId,
    linkSuggestionState.postId,
  ]);

  const saveBackendAutosave = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      return;
    }

    setBackendAutosaveState((previous) => ({
      ...previous,
      isSaving: true,
    }));

    try {
      const response = await fetch(buildApiUrl("/editorial/autosave/"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          draft_key: "new-post",
          payload: {
            title,
            slug,
            excerpt,
            selectedCategory,
            status,
            scheduledFor,
            seoTitle,
            seoDescription,
            canonicalUrl,
            seoNoindex,
            isSponsored,
            disclosureText,
            premiumEnabled,
            adSlotTopEnabled,
            adSlotInlineEnabled,
            adSlotSidebarEnabled,
            faqBlocks,
            editorHtml,
            coverImageUrl,
            coverImagePublicId,
            suggestionPostId: linkSuggestionState.postId,
          },
        }),
      });

      if (response.ok) {
        const payload = await response.json().catch(() => ({}));
        const savedAt = toLocalDateTimeInputValue(payload?.updated_at)
          .replace("T", " ")
          .trim();
        setBackendAutosaveState({
          isSaving: false,
          lastSavedAt: savedAt || new Date().toLocaleTimeString(),
        });
      } else {
        setBackendAutosaveState((previous) => ({
          ...previous,
          isSaving: false,
        }));
      }
    } catch {
      setBackendAutosaveState((previous) => ({
        ...previous,
        isSaving: false,
      }));
    }
  }, [
    title,
    slug,
    excerpt,
    selectedCategory,
    status,
    scheduledFor,
    seoTitle,
    seoDescription,
    canonicalUrl,
    seoNoindex,
    isSponsored,
    disclosureText,
    premiumEnabled,
    adSlotTopEnabled,
    adSlotInlineEnabled,
    adSlotSidebarEnabled,
    faqBlocks,
    editorHtml,
    coverImageUrl,
    coverImagePublicId,
    linkSuggestionState.postId,
  ]);

  useEffect(() => {
    if (!autosaveReadyRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      persistLocalDraft({}, { silent: true });
      void saveBackendAutosave();
    }, 1800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [persistLocalDraft, saveBackendAutosave]);

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

    const payload = await response.json();

    if (!response.ok || !payload?.secure_url) {
      throw new Error(payload?.error?.message || "Cloudinary upload failed.");
    }

    return payload;
  };

  const handleCoverImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploadingCover(true);
    setSubmitState((previous) => ({
      ...previous,
      successMessage: "",
      errorMessage: "",
    }));

    try {
      const uploaded = await uploadToCloudinary(file, "tcb-post-covers");
      setCoverImageUrl(uploaded.secure_url || "");
      setCoverImagePublicId(uploaded.public_id || "");

      setSubmitState((previous) => ({
        ...previous,
        successMessage: "Cover image uploaded to Cloudinary.",
        errorMessage: "",
      }));
    } catch (error) {
      setSubmitState((previous) => ({
        ...previous,
        errorMessage: error?.message || "Could not upload cover image.",
      }));
    } finally {
      setIsUploadingCover(false);
      event.target.value = "";
    }
  };

  const openInlineImagePicker = () => {
    saveSelection();
    inlineImageInputRef.current?.click();
  };

  const handleInlineImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploadingInlineImage(true);
    setSubmitState((previous) => ({
      ...previous,
      successMessage: "",
      errorMessage: "",
    }));

    try {
      const uploaded = await uploadToCloudinary(file, "tcb-inline-images");
      runCommand(
        "insertHTML",
        `<figure><img src="${uploaded.secure_url}" alt="Inserted visual" style="max-width:100%;height:auto;border-radius:12px;" /></figure><p></p>`
      );

      setSubmitState((previous) => ({
        ...previous,
        successMessage: "Inline image inserted from Cloudinary.",
        errorMessage: "",
      }));
    } catch (error) {
      setSubmitState((previous) => ({
        ...previous,
        errorMessage: error?.message || "Could not upload inline image.",
      }));
    } finally {
      setIsUploadingInlineImage(false);
      event.target.value = "";
    }
  };

  const loadInternalSuggestions = async (postIdToLoad) => {
    const normalizedPostId = Number.parseInt(String(postIdToLoad || ""), 10);
    if (Number.isNaN(normalizedPostId)) {
      setLinkSuggestionState((previous) => ({
        ...previous,
        postId: null,
        suggestions: [],
        isLoading: false,
        errorMessage: "Save this draft once to enable internal link suggestions.",
      }));
      return;
    }

    const token = localStorage.getItem("token");
    const requestHeaders = token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined;

    setLinkSuggestionState((previous) => ({
      ...previous,
      postId: normalizedPostId,
      isLoading: true,
      errorMessage: "",
    }));

    try {
      const response = await fetch(
        buildApiUrl(`/posts/${encodeURIComponent(normalizedPostId)}/internal-suggestions/`),
        {
          headers: requestHeaders,
          cache: "no-store",
        }
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload?.detail || `Suggestions request failed with status ${response.status}.`
        );
      }

      const suggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
      setLinkSuggestionState((previous) => ({
        ...previous,
        postId: normalizedPostId,
        suggestions,
        isLoading: false,
        errorMessage: "",
        lastSyncedAt: new Date().toLocaleTimeString(),
      }));
    } catch (error) {
      setLinkSuggestionState((previous) => ({
        ...previous,
        postId: normalizedPostId,
        suggestions: [],
        isLoading: false,
        errorMessage: error?.message || "Unable to load internal link suggestions.",
      }));
    }
  };

  const insertInternalLink = (suggestion, anchorOverride = "") => {
    const anchorCandidate =
      String(anchorOverride || suggestion?.title || "").trim() || "Related article";
    const suggestionSlug = String(suggestion?.slug || "").trim();
    if (!suggestionSlug) {
      return;
    }

    const safeAnchor = escapeHtml(anchorCandidate);
    const href = `/blog/${encodeURIComponent(suggestionSlug)}`;

    runCommand(
      "insertHTML",
      `<a href="${href}" class="font-semibold text-cyan-700 underline">${safeAnchor}</a> `
    );

    setSubmitState((previous) => ({
      ...previous,
      successMessage: `Inserted internal link: ${anchorCandidate}`,
      errorMessage: "",
    }));
  };

  const addFaqBlock = () => {
    setFaqBlocks((previous) => {
      if (previous.length >= 12) {
        return previous;
      }
      return [
        ...previous,
        {
          question: "",
          answer: "",
        },
      ];
    });
  };

  const updateFaqBlock = (index, field, value) => {
    setFaqBlocks((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  };

  const removeFaqBlock = (index) => {
    setFaqBlocks((previous) => {
      if (previous.length <= 1) {
        return [
          {
            question: "",
            answer: "",
          },
        ];
      }
      return previous.filter((_, itemIndex) => itemIndex !== index);
    });
  };

  const insertCalloutBlock = () => {
    runCommand(
      "insertHTML",
      '<aside class="tcb-callout"><p><strong>Key takeaway:</strong> Add the most important insight here.</p></aside><p></p>'
    );
    setSubmitState((previous) => ({
      ...previous,
      successMessage: "Callout block inserted into editor.",
      errorMessage: "",
    }));
  };

  const createPost = async (nextStatus) => {
    if (nextStatus !== "PUBLISHED") {
      setLastPublishedSlug("");
    }

    setSubmitState({
      isSubmitting: true,
      successMessage: "",
      errorMessage: "",
    });

    const token = localStorage.getItem("token");
    if (!token) {
      setSubmitState({
        isSubmitting: false,
        successMessage: "",
        errorMessage: "Session expired. Please log in again.",
      });
      router.push("/login");
      return;
    }

    const normalizedSlug = slugify(slug || title);
    const normalizedExcerpt = excerpt.trim() || buildExcerpt(editorHtml);
    const normalizedCategory = selectedCategory ? Number.parseInt(selectedCategory, 10) : NaN;
    const normalizedScheduledFor = (() => {
      if (!scheduledFor) {
        return "";
      }

      const parsed = new Date(scheduledFor);
      return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
    })();

    if (!title.trim()) {
      setSubmitState({
        isSubmitting: false,
        successMessage: "",
        errorMessage: "Title is required.",
      });
      return;
    }

    if (!normalizedSlug) {
      setSubmitState({
        isSubmitting: false,
        successMessage: "",
        errorMessage: "Slug is required.",
      });
      return;
    }

    if (!normalizedExcerpt) {
      setSubmitState({
        isSubmitting: false,
        successMessage: "",
        errorMessage: "Excerpt is required.",
      });
      return;
    }

    if (Number.isNaN(normalizedCategory)) {
      setSubmitState({
        isSubmitting: false,
        successMessage: "",
        errorMessage: "Category is required.",
      });
      return;
    }

    const resolvedImagePublicId =
      coverImagePublicId || extractCloudinaryPublicIdFromUrl(coverImageUrl);

    if (!resolvedImagePublicId) {
      setSubmitState({
        isSubmitting: false,
        successMessage: "",
        errorMessage:
          "Cover image is required. Upload using the 'Upload to Cloudinary' button.",
      });
      return;
    }

    if (!coverImagePublicId && resolvedImagePublicId) {
      setCoverImagePublicId(resolvedImagePublicId);
    }

    if (nextStatus === "PUBLISHED" && wordCount > publishLimit) {
      setSubmitState({
        isSubmitting: false,
        successMessage: "",
        errorMessage: `For publishing, content must be ${publishLimit} words or fewer.`,
      });
      return;
    }

    const payload = {
      title: title.trim(),
      slug: normalizedSlug,
      excerpt: normalizedExcerpt,
      content: editorHtml,
      faq_blocks: normalizedFaqBlocks,
      seo_title: seoTitle.trim() || title.trim(),
      seo_description: seoDescription.trim() || normalizedExcerpt,
      canonical_url: canonicalUrl.trim(),
      seo_noindex: seoNoindex,
      category: normalizedCategory,
      image: resolvedImagePublicId,
      status: nextStatus,
      is_sponsored: isSponsored,
      disclosure_text: disclosureText.trim(),
      premium_enabled: premiumEnabled,
      ad_slots: {
        top: { enabled: adSlotTopEnabled },
        inline: { enabled: adSlotInlineEnabled },
        sidebar: { enabled: adSlotSidebarEnabled },
      },
      scheduled_for:
        editorialCapabilities.canSchedulePosts && normalizedScheduledFor
          ? normalizedScheduledFor
          : null,
    };

    try {
      const submitPayload = async (body) => {
        const response = await fetch(buildApiUrl("/posts/"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });

        let responsePayload = {};
        let responseStatusText = "";
        const responseContentType = response.headers.get("content-type") || "";

        if (responseContentType.includes("application/json")) {
          responsePayload = await response.json().catch(() => ({}));
        } else {
          responseStatusText = await response.text().catch(() => "");
        }

        return { response, responsePayload, responseStatusText };
      };

      let { response, responsePayload, responseStatusText } = await submitPayload(payload);

      const combinedRawError = `${extractApiErrorMessage(
        responsePayload,
        responseStatusText
      )} ${responseStatusText}`.toLowerCase();

      const shouldRetryWithShortSlug =
        !response.ok &&
        normalizedSlug.length > 50 &&
        (combinedRawError.includes("dataerror") ||
          combinedRawError.includes("character varying(50)") ||
          combinedRawError.includes("no more than 50") ||
          combinedRawError.includes("slug"));

      if (shouldRetryWithShortSlug) {
        const shortSlug = normalizedSlug.slice(0, 50);
        const retryPayload = { ...payload, slug: shortSlug };
        const retryResult = await submitPayload(retryPayload);
        response = retryResult.response;
        responsePayload = retryResult.responsePayload;
        responseStatusText = retryResult.responseStatusText;

        if (response.ok) {
          setSlug(shortSlug);
          setIsSlugCustom(true);
        }
      }

      if (!response.ok) {
        const parsedError = extractApiErrorMessage(
          responsePayload,
          responseStatusText
            ? responseStatusText.slice(0, 180)
            : `Request failed with status ${response.status}.`
        );

        const errorMessage =
          parsedError || "Post creation failed. Check required backend fields.";

        setSubmitState({
          isSubmitting: false,
          successMessage: "",
          errorMessage,
        });
        return;
      }

      setStatus(nextStatus);
      const resolvedPostId = Number.parseInt(String(responsePayload?.id || ""), 10);
      const resolvedResponseSlug = responsePayload?.slug || normalizedSlug;
      if (nextStatus === "PUBLISHED") {
        setLastPublishedSlug(resolvedResponseSlug);
        trackPublishEvent({
          postId: Number.isNaN(resolvedPostId) ? null : resolvedPostId,
          slug: resolvedResponseSlug,
          title: payload.title,
          categoryId: Number.isNaN(normalizedCategory) ? null : normalizedCategory,
          wordCount,
        });
      }
      if (!Number.isNaN(resolvedPostId)) {
        setLinkSuggestionState((previous) => ({
          ...previous,
          postId: resolvedPostId,
        }));
        void loadInternalSuggestions(resolvedPostId);
      }
      persistLocalDraft({
        status: nextStatus,
        suggestionPostId: Number.isNaN(resolvedPostId)
          ? linkSuggestionState.postId
          : resolvedPostId,
      });
      setSubmitState({
        isSubmitting: false,
        successMessage:
          nextStatus === "PUBLISHED"
            ? `Post published successfully: ${resolvedResponseSlug}`
            : `Draft saved to backend: ${resolvedResponseSlug}`,
        errorMessage: "",
      });
    } catch {
      setSubmitState({
        isSubmitting: false,
        successMessage: "",
        errorMessage: getApiUnavailableMessage(),
      });
    }
  };

  if (session.isCheckingAuth || !session.isAuthorized) {
    return (
      <main className="writer-shell grid min-h-screen place-items-center px-4">
        <p className="text-sm font-medium text-slate-600">Checking writer session...</p>
      </main>
    );
  }

  return (
    <main className="writer-shell min-h-screen w-full text-slate-900">
      <input
        ref={coverImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCoverImageChange}
      />
      <input
        ref={inlineImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleInlineImageChange}
      />

      <section className="mx-auto grid min-h-screen w-full max-w-[1680px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px]">
        <aside className="writer-settings-panel order-last px-4 pb-6 pt-4 sm:px-6 lg:sticky lg:top-16 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:px-0 lg:pb-8 lg:pr-6">
          <div className="writer-card-soft rounded-[2rem] p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.35rem] bg-[#17352c] text-base font-black tracking-[0.18em] text-white">
                {writerInitials}
              </span>
              <div className="min-w-0">
                <span className="writer-pill">Post Settings</span>
                <h2 className="mt-4 text-xl font-semibold text-slate-900">Metadata and publishing rail</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Tune structure, media, and search visibility without leaving the writing flow.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="writer-metric-tile rounded-[1.3rem] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Words</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{wordCount}</p>
              </div>
              <div className="writer-metric-tile rounded-[1.3rem] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">SEO</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{seoScoreDetails.score}</p>
              </div>
              <div className="writer-metric-tile rounded-[1.3rem] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Read</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{readingTime}m</p>
              </div>
            </div>

            <div className="mt-5 min-w-0 rounded-[1.5rem] border border-[rgba(20,44,38,0.08)] bg-white/72 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Search Preview
              </p>
              <p className="mt-2 break-words text-sm font-semibold leading-6 text-slate-900 [overflow-wrap:anywhere]">
                {seoPreviewTitle || "Untitled article"}
              </p>
              <p className="mt-1 break-all text-xs font-medium text-[#1f7a67]">
                {slugPreview || "/blog/"}
              </p>
              <p className="mt-3 break-words text-sm leading-6 text-slate-600 [overflow-wrap:anywhere]">
                {seoPreviewDescription || "Add an excerpt and SEO description for a stronger result preview."}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <details open className="group border-b border-slate-100 pb-2">
              <summary className="flex cursor-pointer items-center justify-between py-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-800 outline-none select-none">
                <span>Core Details</span>
                <svg className="w-4 h-4 transition-transform group-open:rotate-180 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="mt-2 space-y-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div>
              <label htmlFor="writer-title" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Title
              </label>
              <input
                id="writer-title"
                value={title}
                onChange={handleTitleChange}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="writer-slug" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Slug
              </label>
              <input
                id="writer-slug"
                value={slug}
                onChange={(event) => {
                  setSlug(event.target.value);
                  setIsSlugCustom(true);
                }}
                maxLength={200}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-cyan-500 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">Preview: {slugPreview || "/blog/"}</p>
            </div>

            <div>
              <label htmlFor="writer-excerpt" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Excerpt
              </label>
              <textarea
                id="writer-excerpt"
                rows={3}
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-cyan-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setExcerpt(buildExcerpt(editorHtml))}
                className="mt-1 text-xs font-semibold text-slate-600 underline underline-offset-2"
              >
                Auto-generate from editor
              </button>
            </div>

              </div>
            </details>

            <details className="group border-b border-slate-100 pb-2">
              <summary className="flex cursor-pointer items-center justify-between py-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-800 outline-none select-none">
                <span>Publishing & Metadata</span>
                <svg className="w-4 h-4 transition-transform group-open:rotate-180 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="mt-2 space-y-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div>
                <label htmlFor="writer-category" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Category
                </label>
                <select
                  id="writer-category"
                  value={selectedCategory}
                  onChange={(event) => setSelectedCategory(event.target.value)}
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
                <label htmlFor="writer-status" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </label>
                <select
                  id="writer-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-cyan-500 focus:outline-none"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                </select>
              </div>
            </div>

            <div className="mt-3">
              <label htmlFor="writer-scheduled-for" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Schedule Publish
              </label>
              <input
                id="writer-scheduled-for"
                type="datetime-local"
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
                disabled={!editorialCapabilities.canSchedulePosts}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm focus:border-cyan-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                {editorialCapabilities.canSchedulePosts
                  ? "Future timestamps publish automatically when the scheduled time arrives."
                  : "Scheduling is enabled for editor or admin roles."}
              </p>
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Publication Metadata</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={seoNoindex}
                    onChange={(event) => setSeoNoindex(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  SEO noindex
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={isSponsored}
                    onChange={(event) => setIsSponsored(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Sponsored content
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={premiumEnabled}
                    onChange={(event) => setPremiumEnabled(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Premium enabled
                </label>
              </div>

              <label htmlFor="writer-disclosure-text" className="mt-3 mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Disclosure Text
              </label>
              <input
                id="writer-disclosure-text"
                value={disclosureText}
                onChange={(event) => setDisclosureText(event.target.value)}
                maxLength={240}
                placeholder="Shown when sponsored content is enabled"
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm focus:border-cyan-500 focus:outline-none"
              />

              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Ad Slots</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={adSlotTopEnabled}
                    onChange={(event) => setAdSlotTopEnabled(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Top
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={adSlotInlineEnabled}
                    onChange={(event) => setAdSlotInlineEnabled(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Inline
                </label>
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={adSlotSidebarEnabled}
                    onChange={(event) => setAdSlotSidebarEnabled(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Sidebar
                </label>
              </div>
            </div>
          </div>
        </details>

            <details className="group border-b border-slate-100 pb-2">
              <summary className="flex cursor-pointer items-center justify-between py-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-800 outline-none select-none">
                <span>Media & Assets</span>
                <svg className="w-4 h-4 transition-transform group-open:rotate-180 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="mt-2 space-y-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cover Image</p>
              <label
                htmlFor="writer-cover-url"
                className="mt-2 mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500"
              >
                Image URL
              </label>
              <input
                id="writer-cover-url"
                value={coverImageUrl}
                onChange={(event) => {
                  setCoverImageUrl(event.target.value);
                  if (event.target.value.trim()) {
                    setCoverImagePublicId("");
                  }
                }}
                placeholder="https://..."
                className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 focus:border-cyan-500 focus:outline-none"
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
              {coverImageUrl && (
                <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <Image
                    src={coverImageUrl}
                    alt="Cover preview"
                    width={640}
                    height={260}
                    className="h-36 w-full object-cover"
                  />
                </div>
              )}
              </div>
            </div>
            </details>

            <details className="group border-b border-slate-100 pb-2">
              <summary className="flex cursor-pointer items-center justify-between py-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-800 outline-none select-none">
                <span>FAQ Builder</span>
                <svg className="w-4 h-4 transition-transform group-open:rotate-180 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="mt-2 space-y-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={addFaqBlock}
                  disabled={faqBlocks.length >= 12}
                  className="inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
                >
                  Add FAQ
                </button>
              </div>
              <p className="mt-2 text-[11px] text-slate-600">
                Structured FAQ is rendered separately on the published page and added to FAQ schema.
              </p>
              <div className="mt-2 space-y-2">
                {faqBlocks.map((item, index) => (
                  <div key={`faq-block-${index}`} className="rounded-lg border border-slate-200 bg-white p-2">
                    <label
                      htmlFor={`faq-question-${index}`}
                      className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Question {index + 1}
                    </label>
                    <input
                      id={`faq-question-${index}`}
                      value={item.question}
                      onChange={(event) =>
                        updateFaqBlock(index, "question", event.target.value)
                      }
                      maxLength={220}
                      placeholder="What problem does this article solve?"
                      className="h-8 w-full rounded-md border border-slate-300 px-2 text-xs focus:border-cyan-500 focus:outline-none"
                    />
                    <label
                      htmlFor={`faq-answer-${index}`}
                      className="mt-2 mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                    >
                      Answer
                    </label>
                    <textarea
                      id={`faq-answer-${index}`}
                      rows={3}
                      value={item.answer}
                      onChange={(event) =>
                        updateFaqBlock(index, "answer", event.target.value)
                      }
                      maxLength={2000}
                      placeholder="Provide a direct answer with clear context."
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:border-cyan-500 focus:outline-none"
                    />
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                      <span>
                        {item.question.trim().length}/220 q chars
                      </span>
                      <button
                        type="button"
                        onClick={() => removeFaqBlock(index)}
                        className="font-semibold text-rose-600 underline underline-offset-2"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Valid FAQ entries: {normalizedFaqBlocks.length} / 12
              </p>
              </div>
            </details>

            <details className="group border-b border-slate-100 pb-2">
              <summary className="flex cursor-pointer items-center justify-between py-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-800 outline-none select-none">
                <span>Quality Gate</span>
                <svg className="w-4 h-4 transition-transform group-open:rotate-180 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="mt-2 space-y-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200 text-xs text-slate-600">
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${wordCount <= publishLimit ? "bg-emerald-500" : "bg-rose-500"}`}
                  style={{ width: `${publishProgress}%` }}
                />
              </div>
              <div className="mt-2 space-y-1">
                <p>Words: {wordCount}</p>
                <p>Reading time: {readingTime} min</p>
                <p className="font-semibold text-slate-700">Publish limit: 0-{publishLimit} words</p>
                <p>
                  {wordsRemainingForPublish > 0
                    ? `${wordsRemainingForPublish} words remaining before publish cap.`
                    : "Publish cap reached. Trim content to publish."}
                </p>
                <p>Content type: Rich HTML</p>
              </div>
              </div>
            </details>

            <details className="group border-b border-slate-100 pb-2">
              <summary className="flex cursor-pointer items-center justify-between py-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-800 outline-none select-none">
                <span>SEO Score</span>
                <svg className="w-4 h-4 transition-transform group-open:rotate-180 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="mt-2 space-y-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200 text-xs text-slate-600">
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${
                    seoScoreDetails.score >= 80
                      ? "bg-emerald-500"
                      : seoScoreDetails.score >= 60
                        ? "bg-amber-500"
                        : "bg-rose-500"
                  }`}
                  style={{ width: `${seoScoreDetails.score}%` }}
                />
              </div>
              <p className="mt-2 font-semibold text-slate-800">
                SEO score: {seoScoreDetails.score}/100
              </p>
              <div className="mt-2 space-y-1">
                {seoScoreDetails.checks.map((check) => (
                  <p
                    key={check.id}
                    className={check.passed ? "text-emerald-700" : "text-slate-500"}
                  >
                    {check.passed ? "PASS" : "TODO"} - {check.label}
                  </p>
                ))}
              </div>
              </div>
            </details>

            <details className="group pb-2">
              <summary className="flex cursor-pointer items-center justify-between py-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-800 outline-none select-none">
                <span>Internal Linking</span>
                <svg className="w-4 h-4 transition-transform group-open:rotate-180 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="mt-2 space-y-4 pb-4 animate-in fade-in slide-in-from-top-1 duration-200 text-xs text-slate-600">
              <p className="mt-2 text-[11px] text-slate-600">
                {linkSuggestionState.postId
                  ? `Suggestions for post #${linkSuggestionState.postId}`
                  : "Save draft/publish once to activate related link suggestions."}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadInternalSuggestions(linkSuggestionState.postId)}
                  disabled={!linkSuggestionState.postId || linkSuggestionState.isLoading}
                  className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400 disabled:opacity-60"
                >
                  {linkSuggestionState.isLoading ? "Refreshing..." : "Refresh Suggestions"}
                </button>
                {linkSuggestionState.lastSyncedAt ? (
                  <p className="text-[11px] text-slate-500">
                    Synced at {linkSuggestionState.lastSyncedAt}
                  </p>
                ) : null}
              </div>

              {linkSuggestionState.errorMessage ? (
                <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">
                  {linkSuggestionState.errorMessage}
                </p>
              ) : null}

              {linkSuggestionState.isLoading ? (
                <div className="mt-2 space-y-2">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div key={index} className="rounded-lg border border-slate-200 bg-white p-2">
                      <div className="h-3 w-4/5 animate-pulse rounded bg-slate-200" />
                      <div className="mt-2 h-2 w-full animate-pulse rounded bg-slate-200" />
                    </div>
                  ))}
                </div>
              ) : null}

              {!linkSuggestionState.isLoading &&
              Array.isArray(linkSuggestionState.suggestions) &&
              linkSuggestionState.suggestions.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {linkSuggestionState.suggestions.slice(0, 4).map((suggestion) => {
                    const primaryAnchor =
                      Array.isArray(suggestion?.anchor_suggestions) &&
                      typeof suggestion.anchor_suggestions[0] === "string"
                        ? suggestion.anchor_suggestions[0]
                        : suggestion?.title || "Related article";

                    return (
                      <article
                        key={suggestion?.id || suggestion?.slug}
                        className="rounded-lg border border-slate-200 bg-white p-2"
                      >
                        <p className="font-semibold text-slate-800">{suggestion?.title}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          Score {typeof suggestion?.score === "number" ? suggestion.score.toFixed(2) : "0.00"}
                        </p>
                        <button
                          type="button"
                          onClick={() => insertInternalLink(suggestion, primaryAnchor)}
                          className="mt-2 inline-flex h-7 items-center rounded-md bg-cyan-700 px-2.5 text-[11px] font-semibold text-white transition hover:bg-cyan-800"
                        >
                          Insert Link
                        </button>

                        {Array.isArray(suggestion?.anchor_suggestions) &&
                        suggestion.anchor_suggestions.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {suggestion.anchor_suggestions.slice(0, 3).map((anchorText) => (
                              <button
                                key={`${suggestion?.id}-${anchorText}`}
                                type="button"
                                onClick={() => insertInternalLink(suggestion, anchorText)}
                                className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-[10px] font-semibold text-cyan-800 transition hover:border-cyan-300"
                                title="Insert with this anchor text"
                              >
                                {anchorText}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              ) : null}
              </div>
            </details>
          </div>
        </aside>

        <section className="flex min-h-screen flex-col px-4 pb-6 pt-4 sm:px-6 lg:px-8">
          <header className="sticky top-16 z-20 space-y-4 pb-2">
            <div className="writer-card relative overflow-hidden rounded-[2rem] px-5 py-5 sm:px-6">
              <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_top_left,rgba(31,122,103,0.16),transparent_52%),radial-gradient(circle_at_top_right,rgba(190,116,63,0.16),transparent_42%)]" />
              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.35rem] bg-[#17352c] text-base font-black tracking-[0.18em] text-white">
                    {writerInitials}
                  </span>
                  <div>
                    <span className="writer-eyebrow">Editor Studio</span>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[2rem]">
                        Rich Post Composer
                      </h2>
                      <span
                        className={`inline-flex rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                          status === "PUBLISHED"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {status}
                      </span>
                    </div>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                      Write, shape metadata, and manage your publishing flow from a calmer editorial workspace.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={persistLocalDraft}
                    className="inline-flex h-11 items-center rounded-full border border-[rgba(20,44,38,0.12)] bg-white/80 px-5 text-sm font-semibold text-slate-700 transition hover:border-[rgba(20,44,38,0.2)] hover:bg-white"
                  >
                    Save Local Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => createPost("DRAFT")}
                    disabled={submitState.isSubmitting}
                    className="inline-flex h-11 items-center rounded-full border border-[rgba(20,44,38,0.12)] bg-white px-5 text-sm font-semibold text-slate-800 transition hover:border-[rgba(20,44,38,0.2)] disabled:opacity-60"
                  >
                    {submitState.isSubmitting && status === "DRAFT" ? "Saving..." : "Save Draft"}
                  </button>
                  <button
                    type="button"
                    onClick={() => createPost("PUBLISHED")}
                    disabled={submitState.isSubmitting}
                    className="inline-flex h-11 items-center rounded-full bg-[#17352c] px-5 text-sm font-semibold text-white transition hover:bg-[#10251f] disabled:opacity-60"
                  >
                    {submitState.isSubmitting && status === "PUBLISHED" ? "Publishing..." : "Publish"}
                  </button>
                </div>
              </div>

              <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="writer-metric-tile rounded-[1.4rem] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Word Count</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{wordCount}</p>
                  <p className="mt-1 text-sm text-slate-600">Target range stays inside the publish cap.</p>
                </div>
                <div className="writer-metric-tile rounded-[1.4rem] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Reading Time</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{readingTime} min</p>
                  <p className="mt-1 text-sm text-slate-600">Fast scan for article depth and pacing.</p>
                </div>
                <div className="writer-metric-tile rounded-[1.4rem] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">SEO Score</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{seoScoreDetails.score}/100</p>
                  <p className="mt-1 text-sm text-slate-600">Live quality signals update while you edit.</p>
                </div>
                <div className="writer-metric-tile rounded-[1.4rem] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Autosave</p>
                  <p className="mt-2 text-xl font-semibold text-slate-900">{autosaveLabel}</p>
                  <p className="mt-1 text-sm text-slate-600">Draft state stays synced locally and remotely.</p>
                </div>
              </div>
            </div>

            <div className="writer-toolbar-shell relative z-10 rounded-[1.75rem] px-3 py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <ToolbarButton title="Bold" onClick={() => runCommand("bold")}>
                  <span className="text-lg font-extrabold">B</span>
                </ToolbarButton>
                <ToolbarButton title="Italic" onClick={() => runCommand("italic")}>
                  <span className="text-lg italic">I</span>
                </ToolbarButton>
                <ToolbarButton title="Underline" onClick={() => runCommand("underline")}>
                  <span className="text-lg underline">U</span>
                </ToolbarButton>
                <ToolbarButton title="Heading 2" onClick={() => runCommand("formatBlock", "h2")}>
                  <span className="text-sm font-semibold">H2</span>
                </ToolbarButton>
                <ToolbarButton title="Heading 3" onClick={() => runCommand("formatBlock", "h3")}>
                  <span className="text-sm font-semibold">H3</span>
                </ToolbarButton>
                <ToolbarButton title="Bullet List" onClick={() => runListCommand("unordered")}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="5" cy="7" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="5" cy="17" r="1.5" fill="currentColor" stroke="none" />
                    <path d="M9 7h10M9 12h10M9 17h10" />
                  </svg>
                </ToolbarButton>
                <ToolbarButton title="Numbered List" onClick={() => runListCommand("ordered")}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 7h2M4 12h2M4 17h2" />
                    <path d="M9 7h10M9 12h10M9 17h10" />
                  </svg>
                </ToolbarButton>
                <ToolbarButton title="Insert Link" onClick={openLinkPrompt}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 14a4 4 0 0 1 0-6l2-2a4 4 0 1 1 6 6l-1.5 1.5" />
                    <path d="M14 10a4 4 0 0 1 0 6l-2 2a4 4 0 0 1-6-6L7.5 10.5" />
                  </svg>
                </ToolbarButton>
                <ToolbarButton title="Insert Callout" onClick={insertCalloutBlock}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3v12" />
                    <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
                    <path d="M8 6h8" />
                  </svg>
                </ToolbarButton>
                <ToolbarButton
                  title={isUploadingInlineImage ? "Uploading Image..." : "Insert Image"}
                  onClick={openInlineImagePicker}
                  disabled={isUploadingInlineImage}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <circle cx="9" cy="10" r="1.5" />
                    <path d="m21 15-4-4-5 5-2-2-4 4" />
                  </svg>
                </ToolbarButton>
                <ToolbarButton title="Clear Formatting" onClick={() => runCommand("removeFormat")}>
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 20h16" />
                    <path d="M6 4h12" />
                    <path d="m9 4 6 12" />
                    <path d="m15 4-6 12" />
                  </svg>
                </ToolbarButton>
              </div>
            </div>

            {submitState.errorMessage ? (
              <p className="relative z-10 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-[0_16px_30px_-26px_rgba(190,24,93,0.35)]">
                {submitState.errorMessage}
              </p>
            ) : null}

            {submitState.successMessage ? (
              <p className="relative z-10 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-[0_16px_30px_-26px_rgba(22,163,74,0.32)]">
                {submitState.successMessage}
              </p>
            ) : null}
          </header>

          <div className="flex-1 pt-4">
            {lastPublishedSlug && (
              <div className="writer-card-soft mb-4 flex flex-wrap gap-2 rounded-[1.5rem] p-4">
                <Link
                  href={`/blog/${lastPublishedSlug}`}
                  className="inline-flex items-center rounded-full bg-[#17352c] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#10251f]"
                >
                  View Published Post
                </Link>
                <Link
                  href="/writer/published"
                  className="inline-flex items-center rounded-full border border-[rgba(20,44,38,0.12)] bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-[rgba(20,44,38,0.2)]"
                >
                  View My Published Posts
                </Link>
              </div>
            )}

            <div className="writer-editor-stage flex h-[calc(100vh-320px)] min-h-[680px] flex-col rounded-[2rem] p-3 sm:p-5">
              <article className="flex h-full justify-center overflow-y-auto rounded-[1.6rem] border border-[rgba(20,44,38,0.08)] bg-white/52 p-4 sm:p-8">
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={syncEditorHtmlFromDom}
                  onKeyUp={saveSelection}
                  onMouseUp={saveSelection}
                  onBlur={saveSelection}
                  className="writer-editor-frame min-h-full w-full max-w-3xl rounded-[1.75rem] px-8 py-10 text-lg leading-8 text-slate-800 outline-none whitespace-pre-wrap break-words [overflow-wrap:anywhere] [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-7 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-7 [&_li]:my-1 focus:ring-0"
                />
              </article>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
