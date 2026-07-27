/**
 * Typed API client with centralized auth-token handling.
 *
 * - Access token lives in MEMORY only (never localStorage).
 * - On 401, a single deduplicated refresh attempt runs, then the request retries once.
 * - Refresh transport is the HttpOnly nsa_refresh cookie (credentials: "include").
 */
import type { ApiErrorBody, ApiSuccess } from "./types";

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080/api/v1";

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

let accessToken: string | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
};

/** Called when a refresh attempt fails permanently (forces UI logout). */
let authFailureHandler: (() => void) | null = null;
export function setAuthFailureHandler(handler: () => void) {
  authFailureHandler = handler;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Attach the Bearer token (default true). */
  auth?: boolean;
}

async function parseEnvelope<T>(res: Response): Promise<T> {
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body (proxy error page, network hiccup) — fall through to generic error.
  }
  const envelope = parsed as Partial<ApiSuccess<T>> & { error?: ApiErrorBody };

  if (!res.ok) {
    const err = envelope?.error;
    throw new ApiRequestError(
      res.status,
      err?.code ?? "HTTP_" + res.status,
      err?.message ?? `Request failed with status ${res.status}`,
      err?.details,
    );
  }
  return (envelope?.data ?? (null as T)) as T;
}

function doFetch<T>(path: string, options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.auth !== false && accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  return fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: "include", // sends the nsa_refresh cookie to auth endpoints
  }).then((res) => parseEnvelope<T>(res));
}

let refreshInFlight: Promise<boolean> | null = null;

/** Attempts one token refresh via the HttpOnly cookie. Deduplicates concurrent calls. */
export function tryRefreshToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  const p = doFetch<{ access_token: string }>("/auth/refresh", {
    method: "POST",
    auth: false,
  })
    .then((data) => {
      tokenStore.set(data.access_token);
      return true;
    })
    .catch(() => {
      tokenStore.set(null);
      return false;
    });

  refreshInFlight = p;
  // Clear as soon as THIS attempt settles (microtask) so the next failure
  // starts a fresh refresh while concurrent callers still share this one.
  void p.finally(() => {
    if (refreshInFlight === p) refreshInFlight = null;
  });
  return p;
}

/** Main request helper: attaches auth, retries once after a successful refresh on 401. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await doFetch<T>(path, options);
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 401 && options.auth !== false) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        return doFetch<T>(path, options);
      }
      authFailureHandler?.();
    }
    throw err;
  }
}