'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { AUTH_CONFIGURED, LOGIN_PATH, ensureSession, readStoredSession } from './session';

interface Props {
  children: ReactNode;
}

type GateState = 'checking' | 'allowed' | 'redirecting';

/**
 * Build the /login URL, remembering where the user was headed.
 *
 * Only same-origin paths are carried across: `next` ends up in a
 * `location.assign` on the other side, so anything that isn't a plain
 * `/path` would turn the login screen into an open redirect.
 */
function loginUrlFor(pathname: string, search: string): string {
  const target = `${pathname}${search}`;
  if (!target.startsWith('/') || target.startsWith('//') || target === LOGIN_PATH) {
    return LOGIN_PATH;
  }
  return `${LOGIN_PATH}?next=${encodeURIComponent(target)}`;
}

/**
 * Keeps the SPA behind the login screen.
 *
 * This runs on the client because the product ships as a static export — there
 * is no server middleware that could redirect first. The trade-off is a brief
 * "checking" frame before the app mounts; we render a neutral shell rather than
 * the app so a signed-out visitor never sees product UI flash by.
 *
 * When Supabase is not configured at all the gate stands down: a repo checkout
 * without apps/web/.env.local should still boot into the app instead of
 * bouncing forever against a login screen that cannot authenticate anyone.
 */
export function AuthGate({ children }: Props) {
  const [state, setState] = useState<GateState>(AUTH_CONFIGURED ? 'checking' : 'allowed');

  useEffect(() => {
    if (!AUTH_CONFIGURED) return;
    let cancelled = false;

    void (async () => {
      const session = await ensureSession();
      if (cancelled) return;
      if (session) {
        setState('allowed');
        return;
      }
      setState('redirecting');
      window.location.replace(loginUrlFor(window.location.pathname, window.location.search));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Signing out in one tab should not leave a live app in the others.
  useEffect(() => {
    if (!AUTH_CONFIGURED || state !== 'allowed') return;
    function handleStorage(event: StorageEvent) {
      if (event.key !== null && event.key !== 'disenia.session') return;
      if (readStoredSession()) return;
      window.location.replace(LOGIN_PATH);
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [state]);

  if (state !== 'allowed') return <div className="od-loading-shell" />;
  return <>{children}</>;
}
