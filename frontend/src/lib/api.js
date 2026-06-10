// Shared API + socket helpers used by every screen.

const runtimeApiBaseUrl = typeof __API_BASE_URL__ !== "undefined" ? __API_BASE_URL__ : "";

export const apiBaseUrl = String(runtimeApiBaseUrl || "").replace(/\/+$/, "");

export const buildApiUrl = (path) => (apiBaseUrl ? `${apiBaseUrl}${path}` : path);

export const getSocketBaseUrl = () => {
  if (!apiBaseUrl) return undefined;
  try {
    const parsed = new URL(apiBaseUrl, window.location.origin);
    return `${parsed.protocol}//${parsed.host}`;
  } catch (_error) {
    return undefined;
  }
};

export const toQueryString = (params) => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value) !== "") {
      query.set(key, String(value));
    }
  }
  return query.toString();
};

const GATEWAY_ERROR_MESSAGE =
  "Cannot reach the server right now. It may be starting up or restarting — please retry in a moment.";

const statusErrorMessage = (status) => {
  if (status === 502 || status === 503 || status === 504) return GATEWAY_ERROR_MESSAGE;
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "The requested resource was not found.";
  if (status >= 500) return `The server encountered an error (${status}). Please try again.`;
  return `Request failed (${status})`;
};

export async function fetchJson(path, { jwtToken = "", onAuthError = null, ...options } = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (jwtToken) {
    headers.Authorization = `Bearer ${jwtToken}`;
  }

  let response;
  try {
    response = await fetch(buildApiUrl(path), { ...options, headers });
  } catch (_networkError) {
    // fetch only rejects on network-level failures (server down, DNS, CORS).
    throw new Error(GATEWAY_ERROR_MESSAGE);
  }

  if (response.status === 204) return null;

  // Only parse bodies that claim to be JSON — a proxy error page is HTML and
  // must never surface as a raw "Unexpected token '<'" parse error.
  const contentType = response.headers.get("content-type") || "";
  let payload = {};
  if (contentType.includes("application/json")) {
    payload = await response.json().catch(() => ({}));
  }

  if (!response.ok) {
    if (response.status === 401 && onAuthError) {
      onAuthError();
    }
    throw new Error(payload.error || statusErrorMessage(response.status));
  }
  return payload;
}
