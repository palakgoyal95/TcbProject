const FALLBACK_API_ORIGIN = "http://127.0.0.1:8000";
const FALLBACK_API_BASE_URL = `${FALLBACK_API_ORIGIN}/api`;
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

function trimTrailingSlashes(value) {
  return String(value || "").replace(/\/+$/, "");
}

function normalizeApiPath(path) {
  const normalizedPath = String(path || "").trim();
  if (!normalizedPath) {
    return "";
  }
  return normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
}

function normalizeBrowserApiBaseUrl(value) {
  const trimmed = trimTrailingSlashes(value);
  if (!trimmed) {
    return "/api-proxy";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export const DIRECT_API_BASE_URL = trimTrailingSlashes(
  process.env.NEXT_PUBLIC_API_URL || FALLBACK_API_BASE_URL
);

export const BROWSER_API_BASE_URL = trimTrailingSlashes(
  normalizeBrowserApiBaseUrl(process.env.NEXT_PUBLIC_BROWSER_API_URL || "/api-proxy")
);

export function getApiBaseUrl() {
  return typeof window === "undefined" ? DIRECT_API_BASE_URL : BROWSER_API_BASE_URL;
}

export function buildApiUrl(path = "") {
  return `${getApiBaseUrl()}${normalizeApiPath(path)}`;
}

export function getApiUnavailableMessage() {
  if (typeof window !== "undefined" && !LOCAL_HOSTS.has(window.location.hostname)) {
    return "Cannot reach the API server. Make sure Django is running and the frontend proxy can reach it.";
  }

  return `Cannot reach API server. Start Django at ${FALLBACK_API_ORIGIN}.`;
}
