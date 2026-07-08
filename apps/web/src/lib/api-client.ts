/**
 * Typed fetch wrapper around the Canva Clone Pro API.
 *
 * - Attaches the in-memory access token to every request.
 * - On a 401, transparently rotates the refresh token (once) and retries.
 * - Access token lives in memory; refresh token in localStorage. In a
 *   hardened deployment the refresh token would be an httpOnly cookie —
 *   the token store is isolated here so that swap is a one-file change.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const REFRESH_KEY = 'ccp.refreshToken';

export interface ApiError {
  statusCode: number;
  error: string;
  message: string | string[];
}

class TokenStore {
  private accessToken: string | null = null;

  getAccess(): string | null {
    return this.accessToken;
  }
  setAccess(token: string | null): void {
    this.accessToken = token;
  }
  getRefresh(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(REFRESH_KEY);
  }
  setRefresh(token: string | null): void {
    if (typeof window === 'undefined') return;
    if (token) window.localStorage.setItem(REFRESH_KEY, token);
    else window.localStorage.removeItem(REFRESH_KEY);
  }
  clear(): void {
    this.accessToken = null;
    this.setRefresh(null);
  }
}

export const tokenStore = new TokenStore();

// Single-flight refresh so concurrent 401s don't trigger multiple rotations.
let refreshInFlight: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) return false;

  const res = await fetch(`${API_URL}/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    tokenStore.clear();
    return false;
  }
  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  tokenStore.setAccess(data.accessToken);
  tokenStore.setRefresh(data.refreshToken);
  return true;
}

async function refreshOnce(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean; // default true
  _retried?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, _retried, headers, ...rest } = options;
  // FormData (file uploads) must NOT get a JSON content-type — the browser
  // sets the multipart boundary itself.
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const finalHeaders: Record<string, string> = {
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...(headers as Record<string, string> | undefined),
  };

  const access = tokenStore.getAccess();
  if (auth && access) {
    finalHeaders.Authorization = `Bearer ${access}`;
  }

  const res = await fetch(`${API_URL}/v1${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });

  if (res.status === 401 && auth && !_retried) {
    const refreshed = await refreshOnce();
    if (refreshed) {
      return apiFetch<T>(path, { ...options, _retried: true });
    }
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => ({
      statusCode: res.status,
      error: 'RequestFailed',
      message: res.statusText,
    }))) as ApiError;
    throw err;
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
