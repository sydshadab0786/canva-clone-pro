import { apiFetch, tokenStore } from '../api-client';
import type { AuthUser } from '../features/auth/authSlice';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AuthResponse {
  user: AuthUser;
  tokens: TokenPair;
}

function persistTokens(tokens: TokenPair): void {
  tokenStore.setAccess(tokens.accessToken);
  tokenStore.setRefresh(tokens.refreshToken);
}

export async function login(input: {
  email: string;
  password: string;
  twoFactorCode?: string;
}): Promise<AuthUser> {
  const res = await apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    auth: false,
    body: input,
  });
  persistTokens(res.tokens);
  return res.user;
}

export async function register(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<AuthUser> {
  const res = await apiFetch<AuthResponse & { verificationToken: string }>('/auth/register', {
    method: 'POST',
    auth: false,
    body: input,
  });
  persistTokens(res.tokens);
  return res.user;
}

/**
 * Resolve the signed-in user's full profile.
 *
 * Deliberately hits /users/me, not /auth/me: the latter returns only the JWT
 * principal ({id, email, role}) and would clobber richer fields like
 * displayName that the UI depends on.
 */
export async function fetchMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>('/users/me', { method: 'GET' });
}

export async function logout(): Promise<void> {
  const refreshToken = tokenStore.getRefresh();
  if (refreshToken) {
    await apiFetch<void>('/auth/logout', { method: 'POST', auth: false, body: { refreshToken } }).catch(
      () => undefined,
    );
  }
  tokenStore.clear();
}
