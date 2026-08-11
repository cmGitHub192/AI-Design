// Attaches the Supabase access token to every daemon API call.
//
// The app makes ~200 bare `fetch('/api/...')` calls. Threading a header through
// each one would be a large, error-prone diff and would silently regress the
// moment someone added call 201 — so the token is attached centrally here, by
// wrapping global fetch once at boot.
//
// Only same-origin `/api` requests are stamped. The token must never ride along
// to a third party (analytics, provider APIs, artifact CDNs); scoping by path
// keeps that from happening by construction.
//
// See `session.ts` for where the token comes from and `AuthGate.tsx` for the
// UI-side gate. The daemon half lives in apps/daemon/src/supabase-auth.ts.

import { clearSession, LOGIN_PATH, readStoredSession } from './session';

const API_PREFIX = '/api';

function isDaemonApiUrl(raw: string): boolean {
  if (raw.startsWith(API_PREFIX)) return true;
  try {
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith(API_PREFIX);
  } catch {
    return false;
  }
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

/**
 * Append the access token as a query parameter.
 *
 * `EventSource` cannot send headers, so SSE endpoints take the token this way;
 * the daemon reads both carriers (see `accessTokenFromRequest`).
 */
export function withAccessToken(path: string): string {
  const token = readStoredSession()?.access_token;
  if (!token) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}access_token=${encodeURIComponent(token)}`;
}

let installed = false;

export function installAuthFetch(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const original = window.fetch.bind(window);
  window.fetch = async function authedFetch(input: RequestInfo | URL, init?: RequestInit) {
    if (!isDaemonApiUrl(urlOf(input))) return original(input, init);

    const token = readStoredSession()?.access_token;
    let response: Response;
    if (!token) {
      response = await original(input, init);
    } else {
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      if (!headers.has('authorization')) headers.set('authorization', `Bearer ${token}`);
      response = await original(input, { ...init, headers });
    }

    // A rejected session means the stored token is dead — keeping it would let
    // every subsequent call fail the same way while the UI still looked
    // signed in. Drop it and hand the user back to the login screen.
    if (response.status === 401 && isSessionRejection(response)) {
      clearSession();
      if (!window.location.pathname.startsWith(LOGIN_PATH)) {
        window.location.replace(LOGIN_PATH);
      }
    }
    return response;
  } as typeof window.fetch;
}

/**
 * Distinguish "your session is bad" from a route's own 401.
 *
 * Routes that proxy third-party providers can return 401 for reasons that have
 * nothing to do with the user's Supabase session; signing the user out over one
 * of those would be a confusing logout in the middle of unrelated work. The
 * daemon marks its own auth failures with a header so we only react to those.
 */
function isSessionRejection(response: Response): boolean {
  return response.headers.get('x-od-auth') === 'required';
}
