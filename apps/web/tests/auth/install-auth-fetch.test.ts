// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { installAuthFetch, withAccessToken } from '../../src/auth/install-auth-fetch';
import { SESSION_KEY } from '../../src/auth/session';

const TOKEN = 'access-token-123';

function seedSession(): void {
  window.localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ access_token: TOKEN, expires_at: Math.floor(Date.now() / 1000) + 3600 }),
  );
}

function authHeaderOf(call: unknown[]): string | null {
  const init = call[1] as RequestInit | undefined;
  return new Headers(init?.headers ?? {}).get('authorization');
}

describe('installAuthFetch', () => {
  let original: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    original = vi.fn(async () => new Response('{}', { status: 200 }));
    window.fetch = original as unknown as typeof window.fetch;
    // The installer is idempotent by design; reset the module so each test
    // wraps its own spy.
    vi.resetModules();
  });

  it('attaches the access token to daemon API calls', async () => {
    seedSession();
    const { installAuthFetch: install } = await import('../../src/auth/install-auth-fetch');
    install();

    await window.fetch('/api/projects');

    expect(authHeaderOf(original.mock.calls[0]!)).toBe(`Bearer ${TOKEN}`);
  });

  it('never attaches the token to a third-party URL', async () => {
    seedSession();
    const { installAuthFetch: install } = await import('../../src/auth/install-auth-fetch');
    install();

    await window.fetch('https://api.example.com/v1/thing');
    await window.fetch('https://project.supabase.co/auth/v1/user');

    expect(authHeaderOf(original.mock.calls[0]!)).toBeNull();
    expect(authHeaderOf(original.mock.calls[1]!)).toBeNull();
  });

  it('leaves an explicit Authorization header alone', async () => {
    seedSession();
    const { installAuthFetch: install } = await import('../../src/auth/install-auth-fetch');
    install();

    await window.fetch('/api/projects', { headers: { Authorization: 'Bearer caller-set' } });

    expect(authHeaderOf(original.mock.calls[0]!)).toBe('Bearer caller-set');
  });

  it('passes through untouched when nobody is signed in', async () => {
    const { installAuthFetch: install } = await import('../../src/auth/install-auth-fetch');
    install();

    await window.fetch('/api/projects');

    expect(authHeaderOf(original.mock.calls[0]!)).toBeNull();
  });
});

describe('withAccessToken', () => {
  beforeEach(() => window.localStorage.clear());

  it('appends the token for EventSource URLs, respecting existing params', () => {
    seedSession();
    expect(withAccessToken('/api/memory/events')).toBe(
      `/api/memory/events?access_token=${TOKEN}`,
    );
    expect(withAccessToken('/api/memory/events?since=1')).toBe(
      `/api/memory/events?since=1&access_token=${TOKEN}`,
    );
  });

  it('returns the path unchanged when there is no session', () => {
    expect(withAccessToken('/api/memory/events')).toBe('/api/memory/events');
  });
});

// Referenced so the static import is not tree-shaken away by the linter; the
// tests above intentionally re-import through `vi.resetModules()`.
void installAuthFetch;
