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

export async function fetchJson(path, { jwtToken = "", onAuthError = null, ...options } = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (jwtToken) {
    headers.Authorization = `Bearer ${jwtToken}`;
  }
  const response = await fetch(buildApiUrl(path), { ...options, headers });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && onAuthError) {
      onAuthError();
    }
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}
