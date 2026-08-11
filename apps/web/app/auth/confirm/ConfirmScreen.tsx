'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { clearEmailLinkFromUrl, parseEmailLink } from '../../../src/auth/email-link';
import { useI18n } from '../../../src/i18n';
import { AuthLandingAction, AuthLandingShell } from '../AuthLandingShell';

/**
 * Landing page for the "confirm your email" link.
 *
 * Supabase has already done the verifying by the time the browser gets here —
 * this page only reports the outcome it finds in the URL.
 *
 * The session Supabase hands back in that URL is deliberately NOT stored.
 * Anyone holding the emailed link could otherwise walk straight into the
 * account; making the user sign in once with their password keeps the mailbox
 * from being a second set of credentials. It also matches what the screen
 * says: "your account is ready, now sign in".
 */
export default function ConfirmScreen(): ReactNode {
  const { t } = useI18n();
  // Read the URL during the first render, NOT in the effect: the effect also
  // scrubs the tokens from the address bar, so a remount (React StrictMode
  // double-invokes, and any future re-render of this route would too) would
  // re-read an already-emptied URL and wrongly report an invalid link.
  const [link] = useState(() => parseEmailLink(window.location));

  useEffect(() => {
    clearEmailLinkFromUrl();
  }, []);

  const ok = Boolean(link.accessToken) && !link.errorCode;
  // Supabase's own wording (e.g. "Email link is invalid or has expired") is
  // more specific than ours when present, so prefer it and keep the generic
  // line as the fallback.
  const detail = ok ? null : link.errorDescription;
  return (
    <AuthLandingShell
      title={ok ? t('login.confirm.title') : t('login.reset.invalidLink')}
      lead={ok ? t('login.confirm.subtitle') : t('login.confirm.failed')}
      alert={!ok && detail ? { tone: 'error', message: detail } : null}
    >
      <AuthLandingAction href="/login">{t('login.signIn')}</AuthLandingAction>
    </AuthLandingShell>
  );
}
