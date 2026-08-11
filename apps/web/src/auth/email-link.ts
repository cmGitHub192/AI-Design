// Reads the result of a Supabase email link (confirmation / password reset).
//
// Supabase's `/auth/v1/verify` redirects back to the app and puts its answer in
// the URL **fragment**: `#access_token=...&type=recovery` on success,
// `#error=...&error_description=...` on failure. The fragment matters — it is
// never sent to a server, which is what keeps a one-time recovery token out of
// access logs and out of any Referer header.
//
// Older links, and some error paths, use the query string instead, so both are
// read. The fragment wins when a value appears in both.

export type EmailLinkType = 'signup' | 'recovery' | 'invite' | 'magiclink' | 'email_change' | string;

export interface EmailLinkResult {
  accessToken: string | null;
  refreshToken: string | null;
  type: EmailLinkType | null;
  /** Machine-readable failure from Supabase, e.g. `otp_expired`. */
  errorCode: string | null;
  /** Human-readable failure text from Supabase, when it sent one. */
  errorDescription: string | null;
}

export function parseEmailLink(location: {
  hash: string;
  search: string;
}): EmailLinkResult {
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(location.search);
  const pick = (key: string): string | null => fragment.get(key) ?? query.get(key);

  return {
    accessToken: pick('access_token'),
    refreshToken: pick('refresh_token'),
    type: pick('type'),
    errorCode: pick('error_code') ?? pick('error'),
    errorDescription: pick('error_description')?.replace(/\+/g, ' ') ?? null,
  };
}

/**
 * Strip the tokens from the address bar once they have been read.
 *
 * Without this the recovery token sits in the URL for the rest of the session —
 * visible over someone's shoulder, and carried into any bookmark or shared
 * link. `replaceState` also keeps it out of the back-button history.
 */
export function clearEmailLinkFromUrl(): void {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', window.location.pathname);
}
