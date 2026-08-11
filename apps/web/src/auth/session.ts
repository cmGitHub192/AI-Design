// Single source of truth for the signed-in Supabase session on the client.
//
// The login screen (app/login/LoginScreen.tsx) writes the session here after a
// successful GoTrue call; the rest of the SPA reads it through this module
// instead of touching localStorage directly. Keeping the shape in one place is
// what lets `AuthGate` and the account menu agree on "who is signed in".
//
// The product is a static export (see next.config.ts), so there is no server
// middleware to gate routes: this module plus `AuthGate` ARE the gate. It keeps
// unauthenticated people out of the UI, but it is not a security boundary —
// the local daemon API stays reachable on its own port either way.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** False when apps/web/.env.local is missing its Supabase keys. */
export const AUTH_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON);

export const SESSION_KEY = 'disenia.session';
export const LOGIN_PATH = '/login';

/** Cookie mirror of the access token, for a future daemon-side check. */
const COOKIE_NAME = 'sb-access-token';

/** Refresh this far before the token actually dies, so a slow call still lands. */
const REFRESH_SKEW_MS = 60_000;

export interface SupabaseUser {
  id?: string;
  email?: string;
  created_at?: string;
  user_metadata?: Record<string, unknown>;
}

export interface StoredSession {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  /** Unix seconds. Normalised on write so readers never have to guess. */
  expires_at?: number;
  user?: SupabaseUser;
}

/** The identity fields the UI actually renders. */
export interface SessionProfile {
  displayName: string;
  firstName: string;
  email?: string;
  idNumber?: string;
  phone?: string;
  /** Raw metadata value ('female' | 'male' | ...), not a translated label. */
  gender?: string;
}

function metaString(meta: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = meta?.[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/** Parse whatever is in storage, tolerating hand-edited or truncated JSON. */
export function readStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null; // storage disabled (private mode, embedded webview)
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const session = parsed as StoredSession;
    return typeof session.access_token === 'string' && session.access_token ? session : null;
  } catch {
    return null;
  }
}

/**
 * Write a GoTrue token response to storage.
 *
 * GoTrue sometimes omits `expires_at` (it always sends `expires_in`), so we
 * normalise to an absolute timestamp here — every reader downstream can then
 * compare against the clock without re-deriving it.
 */
export function persistSession(data: Record<string, unknown>): StoredSession | null {
  const accessToken = typeof data.access_token === 'string' ? data.access_token : '';
  if (!accessToken) return null;

  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
  const expiresAt =
    typeof data.expires_at === 'number'
      ? data.expires_at
      : Math.floor(Date.now() / 1000) + expiresIn;

  const session: StoredSession = {
    ...(data as unknown as StoredSession),
    access_token: accessToken,
    expires_in: expiresIn,
    expires_at: expiresAt,
  };

  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore storage errors — the in-memory session still works this tab */
  }
  try {
    document.cookie = `${COOKIE_NAME}=${accessToken}; path=/; max-age=${expiresIn}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
  return session;
}

export function clearSession(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

/** True while the access token is still safely inside its lifetime. */
export function isFresh(session: StoredSession, now = Date.now()): boolean {
  if (typeof session.expires_at !== 'number') return true; // unknown expiry: trust it
  return session.expires_at * 1000 - REFRESH_SKEW_MS > now;
}

/**
 * Trade the refresh token for a new access token.
 *
 * A refresh token is single-use in Supabase, so a failure here means the
 * session is genuinely dead (revoked, rotated in another tab, or expired past
 * its window) — we clear rather than keep retrying a token that can't work.
 */
async function refreshSession(session: StoredSession): Promise<StoredSession | null> {
  if (!AUTH_CONFIGURED || !session.refresh_token) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    return persistSession(data);
  } catch {
    return null; // offline: treat as "can't prove it's valid right now"
  }
}

/**
 * The session to render the app with, or null when the user must sign in.
 *
 * Callers should treat null as "go to /login": it means there was never a
 * session, or the stored one expired and could not be renewed.
 */
export async function ensureSession(): Promise<StoredSession | null> {
  const stored = readStoredSession();
  if (!stored) return null;
  if (isFresh(stored)) return stored;
  const refreshed = await refreshSession(stored);
  if (!refreshed) clearSession();
  return refreshed;
}

/** Shape a stored session into the fields the account menu renders. */
export function sessionProfile(session: StoredSession | null): SessionProfile | null {
  if (!session) return null;
  const user = session.user;
  const meta = user?.user_metadata;

  const first = metaString(meta, 'first_name');
  const last = metaString(meta, 'last_name');
  const full = metaString(meta, 'full_name') ?? [first, last].filter(Boolean).join(' ');
  const email = user?.email?.trim() || undefined;
  // Fall back to the email's local part so the avatar never renders a bare "?"
  // for accounts created before the metadata fields existed.
  const displayName = full || email?.split('@')[0] || 'Usuario';

  return {
    displayName,
    firstName: first || displayName.split(/\s+/)[0] || displayName,
    email,
    idNumber: metaString(meta, 'id_number'),
    phone: metaString(meta, 'phone'),
    gender: metaString(meta, 'gender'),
  };
}

/**
 * Set a new password using the short-lived token from a recovery email.
 *
 * Lives here rather than in the reset screen so the Supabase endpoint and keys
 * stay in one module. The token is passed in rather than read from storage: a
 * recovery session is deliberately never persisted (see ResetScreen).
 */
export async function updatePassword(
  accessToken: string,
  password: string,
): Promise<{ ok: true } | { ok: false; message: string | null }> {
  if (!AUTH_CONFIGURED) return { ok: false, message: null };
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ password }),
    });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const message =
      typeof data.msg === 'string'
        ? data.msg
        : typeof data.error_description === 'string'
          ? data.error_description
          : null;
    return { ok: false, message };
  } catch {
    return { ok: false, message: null };
  }
}

/**
 * End the session and send the user back to the login screen.
 *
 * The GoTrue call is best-effort: whether or not the server acknowledges it,
 * the local session must go, otherwise a failed network call would leave the
 * user staring at an app they just asked to leave.
 */
export async function signOut(): Promise<void> {
  const session = readStoredSession();
  if (AUTH_CONFIGURED && session?.access_token) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${session.access_token}`,
        },
      });
    } catch {
      /* ignore */
    }
  }
  clearSession();
  window.location.assign(LOGIN_PATH);
}
