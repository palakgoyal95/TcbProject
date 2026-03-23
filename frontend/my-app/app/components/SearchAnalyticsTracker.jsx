"use client";

import { useEffect } from "react";

import { trackSearchEvent } from "../lib/api";

export default function SearchAnalyticsTracker({ query, resultCount, source }) {
  useEffect(() => {
    const normalizedQuery = String(query || "").trim();
    if (!normalizedQuery) {
      return;
    }

    trackSearchEvent({
      eventType: "search_impression",
      query: normalizedQuery,
      resultCount,
      source: source || "search-page",
    });
  }, [query, resultCount, source]);

  return null;
}
