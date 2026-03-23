"use client";

import { useEffect } from "react";
import { buildApiUrl } from "../lib/apiConfig";

export default function PostViewTracker({ slug }) {
  useEffect(() => {
    if (!slug) {
      return;
    }

    const controller = new AbortController();

    const trackView = async () => {
      try {
        await fetch(buildApiUrl(`/posts/${encodeURIComponent(slug)}/track-view/`), {
          method: "POST",
          signal: controller.signal,
          keepalive: true,
        });
      } catch {}
    };

    trackView();

    return () => {
      controller.abort();
    };
  }, [slug]);

  return null;
}
