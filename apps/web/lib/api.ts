const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? (process.env.NODE_ENV === "development" ? "http://localhost:8080" : "")
).trim();

export type FetchOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string | null;
  body?: unknown;
  headers?: Record<string, string>;
};

export function toApiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  if (!API_BASE_URL) {
    return path.startsWith("/") ? path : `/${path}`;
  }

  if (path.startsWith("/")) {
    return `${API_BASE_URL}${path}`;
  }

  return `${API_BASE_URL}/${path}`;
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const authHeaders = buildAuthHeaders(options.token);
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...authHeaders,
    ...options.headers,
  };

  const response = await fetch(toApiUrl(path), {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: "include",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function buildAuthHeaders(token?: string | null): Record<string, string> {
  if (token) {
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  if (typeof window === "undefined") {
    return {};
  }

  const userId = window.localStorage.getItem("hyoka_dev_user_id");
  const email = window.localStorage.getItem("hyoka_dev_email");
  const role = window.localStorage.getItem("hyoka_dev_role");

  if (!userId || !email) {
    return {};
  }

  return {
    "x-dev-user-id": userId,
    "x-dev-email": email,
    ...(role ? { "x-dev-role": role } : {}),
  };
}
