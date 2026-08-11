import assert from 'node:assert/strict';
import { beforeEach, test } from 'vitest';
import {
  accessTokenFromRequest,
  isSupabaseAuthRequired,
  resetSupabaseAuthCacheForTests,
  supabaseAuthConfig,
  verifyAccessToken,
} from '../src/supabase-auth.js';

const CONFIG = { url: 'https://project.supabase.co', anonKey: 'anon-key' };

function request(options: {
  authorization?: string;
  query?: Record<string, unknown>;
  cookie?: string;
}) {
  return {
    get: (name: string) =>
      name.toLowerCase() === 'authorization' ? options.authorization : undefined,
    query: options.query ?? {},
    headers: options.cookie ? { cookie: options.cookie } : {},
  };
}

/** A JWT-shaped token whose payload carries the given `exp` (seconds). */
function tokenWithExpiry(expSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString('base64url');
  return `header.${payload}.signature`;
}

beforeEach(() => {
  resetSupabaseAuthCacheForTests();
});

test('config falls back to the NEXT_PUBLIC_* names the web build uses', () => {
  assert.deepEqual(
    supabaseAuthConfig({
      NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co/',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    } as NodeJS.ProcessEnv),
    CONFIG,
  );
});

test('OD_* names win over NEXT_PUBLIC_* ones', () => {
  const config = supabaseAuthConfig({
    OD_SUPABASE_URL: 'https://daemon.supabase.co',
    OD_SUPABASE_ANON_KEY: 'daemon-key',
    NEXT_PUBLIC_SUPABASE_URL: 'https://web.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'web-key',
  } as NodeJS.ProcessEnv);
  assert.equal(config?.url, 'https://daemon.supabase.co');
  assert.equal(config?.anonKey, 'daemon-key');
});

test('half-configured env yields no config', () => {
  assert.equal(
    supabaseAuthConfig({ OD_SUPABASE_URL: 'https://project.supabase.co' } as NodeJS.ProcessEnv),
    null,
  );
});

test('the guard stays off unless the flag AND config are both present', () => {
  // A flag with no Supabase config must not lock the daemon down: rejecting
  // every request would be worse than the previous open behaviour.
  assert.equal(isSupabaseAuthRequired({ OD_REQUIRE_AUTH: '1' } as NodeJS.ProcessEnv), false);
  assert.equal(
    isSupabaseAuthRequired({
      OD_SUPABASE_URL: CONFIG.url,
      OD_SUPABASE_ANON_KEY: CONFIG.anonKey,
    } as NodeJS.ProcessEnv),
    false,
  );
  assert.equal(
    isSupabaseAuthRequired({
      OD_REQUIRE_AUTH: '1',
      OD_SUPABASE_URL: CONFIG.url,
      OD_SUPABASE_ANON_KEY: CONFIG.anonKey,
    } as NodeJS.ProcessEnv),
    true,
  );
});

test('reads the token from header, query, or cookie', () => {
  assert.equal(accessTokenFromRequest(request({ authorization: 'Bearer abc' })), 'abc');
  assert.equal(accessTokenFromRequest(request({ authorization: 'bearer abc' })), 'abc');
  // EventSource cannot set headers, so SSE passes the token this way.
  assert.equal(accessTokenFromRequest(request({ query: { access_token: 'sse' } })), 'sse');
  assert.equal(
    accessTokenFromRequest(request({ cookie: 'other=1; sb-access-token=cookie-token' })),
    'cookie-token',
  );
  assert.equal(accessTokenFromRequest(request({})), null);
});

test('the header wins when several carriers are present', () => {
  assert.equal(
    accessTokenFromRequest(
      request({ authorization: 'Bearer header', query: { access_token: 'query' } }),
    ),
    'header',
  );
});

test('a valid token resolves to the user and is then served from cache', async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ id: 'user-1', email: 'a@b.co' }), { status: 200 });
  }) as unknown as typeof fetch;

  const token = tokenWithExpiry(Math.floor(Date.now() / 1000) + 3600);
  assert.deepEqual(await verifyAccessToken(token, CONFIG, fetchImpl), {
    id: 'user-1',
    email: 'a@b.co',
  });
  await verifyAccessToken(token, CONFIG, fetchImpl);
  assert.equal(calls, 1, 'second call should not hit the network');
});

test('a rejected token is not cached, so revocation is not sticky', async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response('{}', { status: 401 });
  }) as unknown as typeof fetch;

  assert.equal(await verifyAccessToken('bad', CONFIG, fetchImpl), null);
  assert.equal(await verifyAccessToken('bad', CONFIG, fetchImpl), null);
  assert.equal(calls, 2);
});

test('an already-expired token is re-verified rather than served from cache', async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response(JSON.stringify({ id: 'user-1' }), { status: 200 });
  }) as unknown as typeof fetch;

  // exp in the past: caching it would keep a dead token alive for the full TTL.
  const stale = tokenWithExpiry(Math.floor(Date.now() / 1000) - 10);
  await verifyAccessToken(stale, CONFIG, fetchImpl);
  await verifyAccessToken(stale, CONFIG, fetchImpl);
  assert.equal(calls, 2);
});

test('a network failure fails closed', async () => {
  const fetchImpl = (async () => {
    throw new Error('offline');
  }) as unknown as typeof fetch;
  assert.equal(await verifyAccessToken('whatever', CONFIG, fetchImpl), null);
});

test('a 200 without a user id is rejected', async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ email: 'a@b.co' }), { status: 200 })) as unknown as typeof fetch;
  assert.equal(await verifyAccessToken('shaped-wrong', CONFIG, fetchImpl), null);
});
