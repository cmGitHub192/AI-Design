// Attaches OD_API_TOKEN to the CLI's daemon requests.
//
// `od` reaches the daemon through ~100 bare `fetch` calls. Rather than thread a
// header through every one, this installs a one-time wrapper around global
// fetch. It exists so that turning on OD_REQUIRE_AUTH (see supabase-auth.ts)
// does not take the CLI offline: the browser has a Supabase session to present,
// the terminal has this token.
//
// Scope is deliberately narrow. The token is only ever attached to loopback
// URLs — the CLI also talks to provider APIs, and a wrapper that stamped a
// local secret onto outbound third-party requests would be a credential leak,
// not a convenience.

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

function isLoopbackUrl(raw: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(raw).hostname);
  } catch {
    return false; // relative or malformed: not ours to stamp
  }
}

function urlOf(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return (input as Request).url ?? '';
}

let installed = false;

/**
 * Idempotently wrap global fetch. No-op when OD_API_TOKEN is unset, which is
 * the default local setup — an unauthenticated daemon needs no header.
 */
export function installCliAuthFetch(env: NodeJS.ProcessEnv = process.env): void {
  if (installed) return;
  const token = (env.OD_API_TOKEN ?? '').trim();
  if (!token) return;
  installed = true;

  const original = globalThis.fetch;
  globalThis.fetch = function authedFetch(input, init) {
    if (!isLoopbackUrl(urlOf(input))) return original(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    // Never overwrite an Authorization the caller set on purpose.
    if (!headers.has('authorization')) headers.set('authorization', `Bearer ${token}`);
    return original(input, { ...init, headers });
  } as typeof fetch;
}
