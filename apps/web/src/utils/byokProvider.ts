import type { KnownProvider } from '../state/config';
import { serverByokCoversProtocol } from '../state/serverByok';
import type { ApiProtocol } from '../types';

export function isLocalOllamaBaseUrl(baseUrl: string): boolean {
  try {
    const parsed = new URL(baseUrl);
    const hostname = parsed.hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

/**
 * Whether the user must supply a bearer credential for this provider.
 *
 * Three ways the answer is no: the preset declares it needs none, it is a
 * local Ollama, or — the hosted case — the daemon already holds a key for
 * this exact protocol and injects it server-side.
 *
 * The server check is scoped to a matching protocol on purpose. An operator
 * who configured Azure must not make an Anthropic-shaped provider look
 * credential-free, because that request would reach the proxy with no key at
 * all and fail at send time instead of in Settings.
 */
export function byokProviderRequiresApiKey(
  protocol: ApiProtocol,
  provider: KnownProvider | undefined,
  baseUrl: string,
): boolean {
  if (provider?.requiresApiKey === false) return false;
  if (protocol === 'ollama' && isLocalOllamaBaseUrl(baseUrl)) return false;
  if (serverByokCoversProtocol(protocol)) return false;
  return true;
}
