import type { ByokChatProtocol, ByokChatProviderConfig } from '@open-design/contracts';

/**
 * Operator-supplied BYOK credential defaults.
 *
 * The BYOK contract is client-supplied by design: the browser keeps the
 * provider config in localStorage and posts it with every chat and run
 * request. That is the right shape for a local-first install, where the key
 * belongs to the person at the keyboard. It cannot express a *hosted*
 * deployment, where the operator owns the credential and end users must
 * never hold or see it.
 *
 * These helpers let the daemon supply the missing pieces from its own
 * environment. Two invariants hold:
 *
 *   1. An explicit request field always wins; the environment only fills
 *      gaps. A deployment that sets none of these vars behaves exactly as
 *      it did before.
 *   2. Defaults are scoped to one declared protocol. A request for a
 *      different protocol never receives this credential, so an operator
 *      who configures Azure cannot accidentally leak that key to an
 *      Anthropic-shaped request.
 *
 * Activation is gated on OD_BYOK_PROTOCOL rather than on the presence of a
 * key, because canonical vendor envs (AZURE_OPENAI_API_KEY and friends) are
 * routinely present on cloud hosts for unrelated reasons. Requiring an
 * explicit protocol keeps that ambient state from silently converting a
 * local-first install into a hosted one.
 */

export const BYOK_SERVER_PROTOCOL_ENV = 'OD_BYOK_PROTOCOL';
export const BYOK_SERVER_API_KEY_ENV = 'OD_BYOK_API_KEY';
export const BYOK_SERVER_BASE_URL_ENV = 'OD_BYOK_BASE_URL';
export const BYOK_SERVER_API_VERSION_ENV = 'OD_BYOK_API_VERSION';
export const BYOK_SERVER_MODEL_ENV = 'OD_BYOK_MODEL';

/**
 * Canonical vendor env vars consulted when OD_BYOK_API_KEY is not set, so an
 * operator who already exports the vendor's documented variable does not
 * have to re-paste it. Mirrors the fallback chain in `memory-llm.ts`.
 */
const VENDOR_API_KEY_ENVS: Record<ByokChatProtocol, readonly string[]> = {
  anthropic: ['ANTHROPIC_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  azure: ['AZURE_OPENAI_API_KEY', 'AZURE_API_KEY'],
  google: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'],
  ollama: ['OLLAMA_API_KEY'],
  senseaudio: ['SENSEAUDIO_API_KEY'],
  aihubmix: ['AIHUBMIX_API_KEY'],
};

const KNOWN_PROTOCOLS = new Set<string>(Object.keys(VENDOR_API_KEY_ENVS));

export interface ServerByokDefaults {
  protocol: ByokChatProtocol;
  apiKey: string;
  baseUrl: string;
  apiVersion?: string;
  model?: string;
}

function read(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * The operator-configured key for `protocol`, or '' when none is set.
 * OD_BYOK_API_KEY is the project-reserved override and wins over the
 * vendor-canonical variables.
 */
export function serverByokApiKey(
  protocol: ByokChatProtocol,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const override = read(env, BYOK_SERVER_API_KEY_ENV);
  if (override) return override;
  for (const key of VENDOR_API_KEY_ENVS[protocol] ?? []) {
    const value = read(env, key);
    if (value) return value;
  }
  return '';
}

/**
 * The operator's declared BYOK provider, or null when this daemon is not
 * configured to supply one.
 */
export function resolveServerByokDefaults(
  env: NodeJS.ProcessEnv = process.env,
): ServerByokDefaults | null {
  const protocol = read(env, BYOK_SERVER_PROTOCOL_ENV).toLowerCase();
  if (!protocol || !KNOWN_PROTOCOLS.has(protocol)) return null;
  const typed = protocol as ByokChatProtocol;

  const apiVersion = read(env, BYOK_SERVER_API_VERSION_ENV);
  const model = read(env, BYOK_SERVER_MODEL_ENV);
  return {
    protocol: typed,
    apiKey: serverByokApiKey(typed, env),
    baseUrl: read(env, BYOK_SERVER_BASE_URL_ENV),
    ...(apiVersion ? { apiVersion } : {}),
    ...(model ? { model } : {}),
  };
}

/**
 * Fill the gaps in a client-supplied provider config from the operator's
 * environment. Returns `provider` untouched when this daemon supplies no
 * defaults, or when the request names a different protocol.
 */
export function applyServerByokDefaults(
  provider: Partial<ByokChatProviderConfig> | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): Partial<ByokChatProviderConfig> | null {
  const defaults = resolveServerByokDefaults(env);
  if (!defaults) return provider ?? null;

  // An absent provider means the client holds no credential at all — the
  // hosted case this module exists for.
  const requested = provider?.protocol;
  if (requested && requested !== defaults.protocol) return provider ?? null;

  const base = provider ?? {};
  const pick = (own: unknown, fallback: string | undefined): string | undefined => {
    const trimmed = typeof own === 'string' ? own.trim() : '';
    if (trimmed) return trimmed;
    return fallback || undefined;
  };

  const apiKey = pick(base.apiKey, defaults.apiKey) ?? '';
  const baseUrl = pick(base.baseUrl, defaults.baseUrl);
  const apiVersion = pick(base.apiVersion, defaults.apiVersion);
  const model = pick(base.model, defaults.model);

  return {
    ...base,
    protocol: defaults.protocol,
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
    ...(apiVersion ? { apiVersion } : {}),
    ...(model ? { model } : {}),
  };
}

/**
 * Fill a `/api/proxy/<protocol>/stream` request body from the operator's
 * environment. Only fills when the operator declared this exact protocol, so
 * each proxy route stays scoped to its own credential.
 */
export function applyServerProxyDefaults<T extends Record<string, unknown>>(
  protocol: ByokChatProtocol,
  body: T,
  env: NodeJS.ProcessEnv = process.env,
): T {
  const defaults = resolveServerByokDefaults(env);
  if (!defaults || defaults.protocol !== protocol) return body;

  const filled = { ...body };
  const fill = (field: 'apiKey' | 'baseUrl' | 'apiVersion' | 'model') => {
    const own = filled[field];
    const hasOwn = typeof own === 'string' && own.trim().length > 0;
    if (hasOwn) return;
    const fallback = defaults[field];
    if (fallback) (filled as Record<string, unknown>)[field] = fallback;
  };
  fill('apiKey');
  fill('baseUrl');
  fill('apiVersion');
  fill('model');
  return filled;
}

/**
 * True when this daemon can serve model traffic without the client holding a
 * credential. Drives the "configured by your administrator" affordance in
 * Settings so the UI stops demanding a key the user does not have.
 */
export function hasServerByokCredential(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const defaults = resolveServerByokDefaults(env);
  return Boolean(defaults && defaults.apiKey);
}
