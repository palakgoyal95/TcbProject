"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getPostComments, submitPostComment } from "../lib/api";

function formatCommentDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function PostComments({ slug }) {
  const [token, setToken] = useState("");
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const syncToken = () => {
      setToken(localStorage.getItem("token") || "");
    };

    syncToken();
    window.addEventListener("storage", syncToken);
    window.addEventListener("writer:profile-updated", syncToken);

    return () => {
      window.removeEventListener("storage", syncToken);
      window.removeEventListener("writer:profile-updated", syncToken);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadComments = async () => {
      setIsLoading(true);
      setLoadError("");
      try {
        const commentList = await getPostComments(slug);
        if (!cancelled) {
          setComments(commentList);
        }
      } catch {
        if (!cancelled) {
          setLoadError("Unable to load comments right now.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadComments();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = content.trim();

    if (!trimmed) {
      setSubmitError("Write a comment before posting.");
      setSubmitMessage("");
      return;
    }

    if (!token) {
      setSubmitError("Please log in to post a comment.");
      setSubmitMessage("");
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitError("");
      setSubmitMessage("");
      const created = await submitPostComment(slug, trimmed, token);
      setComments((current) => [created, ...current]);
      setContent("");
      setSubmitMessage("Comment posted.");
    } catch (error) {
      setSubmitError(error?.message || "Unable to post comment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="public-panel-soft rounded-[1.75rem] px-5 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-semibold text-slate-900">Comments</h2>
        <p className="text-sm text-slate-500">{comments.length} total</p>
      </div>

      <form onSubmit={handleSubmit} className="public-note mt-5 space-y-3 rounded-[1.5rem] p-4">
        <label htmlFor="post-comment" className="block text-sm font-semibold text-slate-700">
          Share your thoughts
        </label>
        <textarea
          id="post-comment"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          suppressHydrationWarning
          rows={4}
          placeholder={token ? "Write your comment..." : "Log in to write a comment..."}
          className="public-textarea w-full rounded-[1.2rem] px-4 py-3 text-sm"
        />
        {!token && (
          <p className="text-sm text-slate-600">
            You need to{" "}
            <Link href="/login" className="font-semibold text-[#1f7a67] hover:text-[#17352c]">
              log in
            </Link>{" "}
            to post comments.
          </p>
        )}
        {(submitError || submitMessage) && (
          <p className={`text-sm ${submitError ? "text-rose-600" : "text-emerald-700"}`}>
            {submitError || submitMessage}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="public-button-primary inline-flex px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Posting..." : "Post Comment"}
        </button>
      </form>

      {isLoading ? (
        <p className="mt-5 text-sm text-slate-500">Loading comments...</p>
      ) : loadError ? (
        <p className="mt-5 text-sm text-rose-600">{loadError}</p>
      ) : comments.length === 0 ? (
        <p className="public-empty mt-5 rounded-[1.25rem] px-4 py-3 text-sm text-slate-600">
          No comments yet. Be the first one to comment.
        </p>
      ) : (
        <div className="mt-5 space-y-3">
          {comments.map((comment) => (
            <article
              key={comment?.id || `${comment?.user}-${comment?.created_at}`}
              className="public-note rounded-[1.25rem] p-4"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">
                  @{comment?.user_username || `user-${comment?.user || "anon"}`}
                </span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>{formatCommentDate(comment?.created_at)}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">
                {comment?.content || ""}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
