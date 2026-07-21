import { useSyncExternalStore } from 'react';
import type { ServerByokStatus } from '@open-design/contracts';

/**
 * Whether this daemon supplies its own model credential (see
 * `apps/daemon/src/byok-server-defaults.ts`).
 *
 * Deployment truth, not user preference: it comes from the daemon's
 * environment, never changes for the life of the page, and is deliberately
 * kept out of `AppConfig` so it can never be persisted to localStorage or
 * synced back through `PUT /api/app-config`.
 *
 * It lives in a module store rather than React state because both worlds need
 * it: `SettingsDialog` reads it during render, while `streamProxyEndpoint` is
 * a plain async function that cannot call a hook.
 *
 * Defaults to not-configured, so every code path behaves exactly as it did
 * before until the daemon says otherwise. A failed or absent read leaves that
 * default in place — a local-first install keeps asking for the user's key.
 */

const NOT_CONFIGURED: ServerByokStatus = { configured: false };

let current: ServerByokStatus = NOT_CONFIGURED;
const listeners = new Set<() => void>();

/** Synchronous read for non-React callers. */
export function serverByokSnapshot(): ServerByokStatus {
  return current;
}

/**
 * True when the daemon covers this exact protocol. Scoped on purpose: an
 * operator who configured Azure must not make an Anthropic-shaped request
 * look credential-free, because it would then reach the proxy with no key.
 */
export function serverByokCoversProtocol(protocol: string): boolean {
  return current.configured && current.protocol === protocol;
}

function setStatus(next: ServerByokStatus): void {
  if (next.configured === current.configured && next.protocol === current.protocol) {
    return;
  }
  current = next;
  for (const listener of listeners) listener();
}

/**
 * Adopt the `serverByok` field of a `GET /api/app-config` body.
 *
 * Called from `fetchDaemonConfig` so the status rides along with the request
 * the app already makes at startup — no extra round-trip, and the notice is
 * in place on first paint instead of replacing the key field a moment later.
 *
 * Anything unexpected (older daemon, error body, hand-rolled JSON) degrades
 * to not-configured rather than throwing.
 */
export function adoptServerByokStatus(body: unknown): void {
  const raw = (body as { serverByok?: unknown } | null | undefined)?.serverByok;
  if (!raw || typeof raw !== 'object') return setStatus(NOT_CONFIGURED);
  const status = raw as Partial<ServerByokStatus>;
  if (status.configured !== true || typeof status.protocol !== 'string') {
    return setStatus(NOT_CONFIGURED);
  }
  setStatus({
    configured: true,
    protocol: status.protocol,
    ...(typeof status.model === 'string' && status.model ? { model: status.model } : {}),
  });
}

/** Test seam. */
export function __setServerByokStatusForTest(next: ServerByokStatus): void {
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React read. Re-renders once the daemon's answer arrives. */
export function useServerByok(): ServerByokStatus {
  return useSyncExternalStore(subscribe, serverByokSnapshot, serverByokSnapshot);
}
