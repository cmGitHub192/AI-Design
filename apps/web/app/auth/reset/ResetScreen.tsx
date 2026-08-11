'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

import { clearEmailLinkFromUrl, parseEmailLink } from '../../../src/auth/email-link';
import { updatePassword } from '../../../src/auth/session';
import { useI18n } from '../../../src/i18n';
import { AuthLandingAction, AuthLandingShell } from '../AuthLandingShell';
import styles from '../../login/login.module.css';

const MIN_PASSWORD = 8;

const LOCK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7a4 4 0 018 0v3.5" />
    <circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

/**
 * Landing page for the "reset your password" link.
 *
 * The recovery token arrives in the URL fragment and is kept in component
 * state only — never written to storage. A recovery link is a single-purpose
 * credential: it should be able to set a password and nothing else. Persisting
 * it would turn "I clicked a link in my inbox" into a full logged-in session,
 * so after a successful change the user signs in normally with the new
 * password.
 */
export default function ResetScreen(): ReactNode {
  const { t } = useI18n();
  // Read the URL during the first render, NOT in the effect: the effect scrubs
  // the token from the address bar, so a remount would re-read an emptied URL
  // and wrongly report an invalid link.
  const [link] = useState(() => parseEmailLink(window.location));
  const [token, setToken] = useState<string | null>(
    link.accessToken && !link.errorCode ? link.accessToken : null,
  );
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    link.accessToken && !link.errorCode ? null : link.errorDescription,
  );
  const [done, setDone] = useState(false);

  useEffect(() => {
    clearEmailLinkFromUrl();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setError(t('login.error.passwordTooShort', { min: MIN_PASSWORD }));
      return;
    }
    if (password !== confirm) {
      setError(t('login.error.passwordMismatch'));
      return;
    }
    if (!token) return;

    setBusy(true);
    setError(null);
    const result = await updatePassword(token, password);
    setBusy(false);
    if (result.ok) {
      setDone(true);
      // The token is spent; drop it so a stray re-submit cannot reuse it.
      setToken(null);
      return;
    }
    setError(result.message ?? t('login.error.unexpected'));
  }

  if (done) {
    return (
      <AuthLandingShell title={t('login.reset.newTitle')} lead={t('login.reset.done')}>
        <AuthLandingAction href="/login">{t('login.signIn')}</AuthLandingAction>
      </AuthLandingShell>
    );
  }

  if (!token) {
    return (
      <AuthLandingShell
        title={t('login.reset.invalidLink')}
        lead={t('login.reset.subtitle')}
        alert={error ? { tone: 'error', message: error } : null}
      >
        <AuthLandingAction href="/login">{t('login.forgotPassword')}</AuthLandingAction>
      </AuthLandingShell>
    );
  }

  return (
    <AuthLandingShell
      title={t('login.reset.newTitle')}
      lead={t('login.reset.newSubtitle')}
      alert={error ? { tone: 'error', message: error } : null}
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="new-password">
            {t('login.field.password')}
          </label>
          <div className={styles.inputWrap}>
            <span className={styles.inputIcon}>{LOCK_ICON}</span>
            <input
              id="new-password"
              className={styles.input}
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="confirm-password">
            {t('login.field.confirmPassword')}
          </label>
          <div className={styles.inputWrap}>
            <span className={styles.inputIcon}>{LOCK_ICON}</span>
            <input
              id="confirm-password"
              className={styles.input}
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
        </div>

        <button className={styles.submit} type="submit" disabled={busy}>
          {busy ? <span className={styles.spinner} aria-hidden /> : null}
          {t('login.reset.save')}
        </button>
      </form>
    </AuthLandingShell>
  );
}
