// Supabase session enforcement for the daemon HTTP API.
//
// The web UI gates its own routes (apps/web/src/auth/AuthGate.tsx), but that is
// a UI gate only: anything that can reach the daemon port can call /api
// directly. This module is the server-side half — when enabled, every /api
// request must carry proof of a signed-in Supabase user.
//
// Verification strategy: token introspection against Supabase (`GET
// /auth/v1/user`) rather than local JWT signature checks. Introspection works
// regardless of whether the project signs with HS256 or an asymmetric key,
// needs no JWKS handling or new dependencies, and honours revocation
// immediately. The per-token cache below keeps the cost to roughly one network
// round trip per token per TTL.
//
// Enabling this is opt-in (OD_REQUIRE_AUTH); see the "API authentication"
// section of apps/daemon/AGENTS.md for the full environment contract.

import { isTruthyEnvFlag } from './api-token-auth.js';

/** How long a successful verification is trusted before re-checking. */
const CACHE_TTL_MS = 5 * 60_000;
/** Bound the cache so a token-spraying client cannot grow it without limit. */
const CACHE_MAX_ENTRIES = 64;
/** Give up on a hung Supabase rather than holding the request forever. */
const VERIFY_TIMEOUT_MS = 8_000;

export interface SupabaseAuthConfig {
  url: string;
  anonKey: string;
}

export interface VerifiedUser {
  id: string;
  email?: string;
}

interface CacheEntry {
  user: VerifiedUser;
  /** Epoch ms after which this entry must be re-verified. */
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function supabaseAuthConfig(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseAuthConfig | null {
  // OD_* is the daemon's own naming; the NEXT_PUBLIC_* fallbacks let a single
  // .env.local drive both the web build and a daemon started from the same
  // shell, which is how the local dev loop actually runs.
  const url = (env.OD_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
  const anonKey = (env.OD_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/**
 * Whether /api should demand a signed-in user.
 *
 * Requires BOTH the opt-in flag and usable Supabase config: a half-configured
 * daemon that rejected every request would be a much worse failure than one
 * that keeps its current open-on-loopback behaviour.
 */
export function isSupabaseAuthRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  if (!isTruthyEnvFlag(env.OD_REQUIRE_AUTH)) return false;
  return supabaseAuthConfig(env) != null;
}

/**
 * Pull the access token off a request.
 *
 * Three carriers, because not every client can send a header: `fetch` uses
 * Authorization, `EventSource` cannot set headers at all and so passes
 * `?access_token=`, and the cookie is the fallback for plain document loads.
 */
export function accessTokenFromRequest(req: {
  get(name: string): string | undefined;
  query?: Record<string, unknown>;
  headers?: Record<string, unknown>;
}): string | null {
  const auth = req.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)\s*$/i.exec(auth);
  if (match) return match[1] ?? null;

  const queryToken = req.query?.access_token;
  if (typeof queryToken === 'string' && queryToken.trim()) return queryToken.trim();

  const cookie = typeof req.headers?.cookie === 'string' ? req.headers.cookie : '';
  const cookieMatch = /(?:^|;\s*)sb-access-token=([^;]+)/.exec(cookie);
  if (cookieMatch?.[1]) {
    try {
      return decodeURIComponent(cookieMatch[1]);
    } catch {
      return cookieMatch[1];
    }
  }
  return null;
}

/**
 * Read `exp` out of a JWT payload without verifying it.
 *
 * Only used to shorten the cache TTL — never to decide that a token is valid.
 * An attacker controlling this value can make us re-verify sooner, which is
 * harmless.
 */
function unverifiedExpiryMs(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      exp?: unknown;
    };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function rememberVerified(token: string, user: VerifiedUser): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Oldest insertion first — Map preserves insertion order.
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  const tokenExpiry = unverifiedExpiryMs(token);
  const ttlExpiry = Date.now() + CACHE_TTL_MS;
  cache.set(token, {
    user,
    expiresAt: tokenExpiry ? Math.min(tokenExpiry, ttlExpiry) : ttlExpiry,
  });
}

/**
 * Verify an access token against Supabase, or return null.
 *
 * Cached hits answer without a network call. On a network failure with no
 * cache entry we fail closed: we cannot tell a revoked token from an
 * unreachable server, and guessing "allow" there would defeat the whole gate.
 */
export async function verifyAccessToken(
  token: string,
  config: SupabaseAuthConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<VerifiedUser | null> {
  const cached = cache.get(token);
  if (cached) {
    if (cached.expiresAt > Date.now()) return cached.user;
    cache.delete(token);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${config.url}/auth/v1/user`, {
      headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { id?: unknown; email?: unknown };
    if (typeof body.id !== 'string' || !body.id) return null;
    const user: VerifiedUser = {
      id: body.id,
      ...(typeof body.email === 'string' ? { email: body.email } : {}),
    };
    rememberVerified(token, user);
    return user;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Drop a token from the cache — used when a client signs out. */
export function forgetAccessToken(token: string): void {
  cache.delete(token);
}

export function resetSupabaseAuthCacheForTests(): void {
  cache.clear();
}
