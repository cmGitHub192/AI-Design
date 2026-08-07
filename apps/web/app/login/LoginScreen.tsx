'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { LOCALE_LABEL, LOCALES, useI18n, type Locale } from '../../src/i18n';
import styles from './login.module.css';

/**
 * Disenia auth screen.
 *
 * Talks to Supabase Auth (GoTrue) directly over its REST API with `fetch`, so
 * it needs no npm package (the workspace currently can't resolve new deps). The
 * session (access + refresh token) is stored client-side; app-wide gating and
 * daemon-side userId scoping are the next phase.
 *
 * Copy comes from the shared `login.*` dictionary, so the screen follows the
 * app-wide locale and the picker here switches the whole app, not just this
 * page.
 *
 * Configure with apps/web/.env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON);
const ENV_FILE = 'apps/web/.env.local';

const SESSION_KEY = 'disenia.session';
const MIN_PASSWORD = 8;

type Mode = 'signin' | 'signup' | 'reset';

/** Outer four-pointed star of the Disenia mark (source: Disenia logo.svg). */
const MARK_STAR =
  'M67.1689 15.749C73.2539 26.8232 79.6042 36.057 87.5859 44.2852C95.728 52.6786 105.345 59.7999 117.649 66.8125C105.829 73.1701 96.2274 79.7532 88 87.8711C79.9035 95.8599 73.3703 105.104 67.3037 116.594C60.1244 103.547 52.8202 93.6112 44.2432 85.4678C36.7048 78.3106 28.3845 72.7329 18.7422 67.6387C28.4108 62.8354 36.4087 56.7844 43.6797 49.0615C52.067 40.1529 59.3589 29.1365 67.1689 15.749Z';

/** Amber core nested inside the star. */
const MARK_CORE =
  'M43 67.0824C54.5426 71.8461 60.1175 76.0247 66.6754 89C72.1848 77.2623 77.4923 72.6327 90 67.0824C77.064 61.0326 72.334 55.9388 66.6754 45C59.2244 57.5543 54.6312 63.6863 43 67.0824Z';

/**
 * The Disenia logo, exactly as authored in `Disenia logo.svg`: white star,
 * vertical purple gradient outline, amber core.
 *
 * The gradient id is per-instance (`useId`) because several marks share the
 * document and duplicated ids would cross-reference.
 */
function Mark({ size = 40 }: { size?: number }): ReactNode {
  const gradientId = `disenia-mark-${useId()}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 134 134"
      fill="none"
      aria-hidden="true"
      className={styles.sparkle}
    >
      <defs>
        <linearGradient id={gradientId} x1="67" y1="0" x2="67" y2="133.5" gradientUnits="userSpaceOnUse">
          <stop offset="0.560928" stopColor="#6C2EED" />
          <stop offset="1" stopColor="#1A0643" />
        </linearGradient>
      </defs>
      <path d={MARK_STAR} fill="white" stroke={`url(#${gradientId})`} strokeWidth="15" />
      <path d={MARK_CORE} fill="#F9D265" />
    </svg>
  );
}

/**
 * Decorative sparkle — ornament, not the logo.
 *
 * The real mark carries a 15-unit outline that collapses into a blob below
 * ~40px, so the floating accents and the in-button glyph use this slim star
 * instead. Anywhere the brand is actually being *identified*, use `Mark`.
 */
function Spark({ size = 24, color = '#6c2eed' }: { size?: number; color?: string }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className={styles.sparkle}>
      <path
        d="M50 2 C54 33 67 46 98 50 C67 54 54 67 50 98 C46 67 33 54 2 50 C33 46 46 33 50 2Z"
        fill={color}
      />
    </svg>
  );
}

/**
 * Renders the hero headline, emphasising the fragment each translation wraps
 * in `*asterisks*`. Marking it in the string (rather than splitting the
 * sentence into two keys) lets every language put the emphasis where its own
 * word order needs it — Japanese can't keep it last, Spanish can.
 */
function Headline({ text }: { text: string }): ReactNode {
  const parts = text.split(/\*(.+?)\*/);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          return (
            <span key={i} className={styles.headlineAccent}>
              {part}
            </span>
          );
        }
        // A lone trailing full stop keeps the muted tint from the mockup.
        if (/^[.。．!！?？]$/.test(part)) {
          return (
            <span key={i} className={styles.headlineDot}>
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/** Language picker for the auth screen; switches the app-wide locale. */
function LanguagePicker({ label }: { label: string }): ReactNode {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.langWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.langBtn}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
        </svg>
        {LOCALE_LABEL[locale]}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div className={styles.langMenu} role="menu">
          {LOCALES.map((code) => (
            <button
              key={code}
              type="button"
              role="menuitemradio"
              aria-checked={locale === code}
              className={`${styles.langItem}${locale === code ? ` ${styles.langItemActive}` : ''}`}
              onClick={() => {
                setLocale(code as Locale);
                setOpen(false);
              }}
            >
              {LOCALE_LABEL[code]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const MAIL_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M3.5 7.5l8.5 6 8.5-6" />
  </svg>
);

const LOCK_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7a4 4 0 018 0v3.5" />
    <circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

const USER_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.8 20a7.2 7.2 0 0114.4 0" />
  </svg>
);

const ID_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
    <circle cx="9" cy="11" r="2" />
    <path d="M5.8 16a3.4 3.4 0 016.4 0M14.5 10.5h4M14.5 14h4" />
  </svg>
);

const PHONE_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M10.5 18.5h3" />
  </svg>
);

const GENDER_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="10.5" cy="13.5" r="5" />
    <path d="M14.5 9.5L20 4M20 4h-4.5M20 4v4.5" />
  </svg>
);

async function gotrue(
  path: string,
  body: Record<string, unknown>,
  fallbackError: string,
): Promise<Record<string, any>> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error_description || data.msg || data.error || fallbackError;
    throw new Error(String(msg));
  }
  return data;
}

export default function LoginScreen(): ReactNode {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>('signin');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const copy = {
    signin: {
      title: t('login.signin.title'),
      lead: t('login.signin.subtitle'),
      cta: t('login.signin.cta'),
    },
    signup: {
      title: t('login.signup.title'),
      lead: t('login.signup.subtitle'),
      cta: t('login.signup.cta'),
    },
    reset: {
      title: t('login.reset.title'),
      lead: t('login.reset.subtitle'),
      cta: t('login.reset.cta'),
    },
  }[mode];

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Field validation runs before the config check: a user fixing their own
    // typo shouldn't have to get past an infrastructure message first.
    if (mode === 'signup') {
      if (password.length < MIN_PASSWORD) {
        setError(t('login.error.passwordTooShort', { min: MIN_PASSWORD }));
        return;
      }
      if (password !== confirm) {
        setError(t('login.error.passwordMismatch'));
        return;
      }
    }
    if (!CONFIGURED) {
      setError(t('login.error.notConfigured'));
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'reset') {
        await gotrue('recover', { email }, t('login.error.unexpected'));
        setNotice(t('login.notice.resetSent'));
      } else if (mode === 'signup') {
        const data = await gotrue(
          'signup',
          {
            email,
            password,
            // Everything else rides as user_metadata. `phone` must stay in
            // here — a top-level `phone` would make GoTrue treat this as an
            // SMS signup instead of an email one.
            data: {
              first_name: firstName,
              last_name: lastName,
              full_name: `${firstName} ${lastName}`.trim(),
              id_number: idNumber || null,
              phone: phone || null,
              gender: gender || null,
            },
          },
          t('login.error.unexpected'),
        );
        if (data.access_token) {
          persistSession(data);
          window.location.assign('/');
          return;
        }
        // Email confirmation required: drop back to sign-in with the notice
        // intact (switchMode would clear it).
        setMode('signin');
        setNotice(t('login.notice.accountCreated'));
      } else {
        const data = await gotrue(
          'token?grant_type=password',
          { email, password },
          t('login.error.unexpected'),
        );
        persistSession(data);
        window.location.assign('/');
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.error.unexpected'));
    } finally {
      setBusy(false);
    }
  }

  function persistSession(data: Record<string, any>) {
    try {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch {
      /* ignore storage errors */
    }
    if (data.access_token) {
      // Readable cookie so the daemon/middleware can pick up the token next phase.
      document.cookie = `sb-access-token=${data.access_token}; path=/; max-age=${data.expires_in ?? 3600}; SameSite=Lax`;
    }
  }

  const isSignup = mode === 'signup';

  return (
    <div className={styles.page}>
      {/* LEFT — brand + hero (desktop only) */}
      <div className={styles.left}>
        <span className={`${styles.pageSpark} ${styles.ps1}`} aria-hidden="true">
          <Spark size={26} color="#a78bfa" />
        </span>
        <span className={`${styles.pageSpark} ${styles.ps2}`} aria-hidden="true">
          <Spark size={22} color="#f6a623" />
        </span>

        <div className={styles.brand}>
          <Mark size={64} />
          <div className={styles.brandText}>
            <span className={styles.brandName}>
              Disen<span className={styles.brandNameAccent}>ia</span>
            </span>
            <span className={styles.brandTagline}>Your AI Design Copilot</span>
          </div>
        </div>

        <h1 className={styles.headline}>
          <Headline text={t('login.hero.headline')} />
        </h1>

        <p className={styles.subtitle}>{t('login.hero.subtitle')}</p>

        <div className={styles.illustration} aria-hidden="true">
          {/* back canvas window with a selected image placeholder */}
          <div className={styles.wireWindow}>
            <div className={styles.wireBar}>
              <div className={styles.wireDots}>
                <span />
                <span />
                <span />
              </div>
              <div className={styles.wirePills}>
                <span />
                <span />
              </div>
            </div>
            <div className={styles.selection}>
              <div className={styles.imgPlaceholder}>
                <svg viewBox="0 0 100 62" fill="none">
                  <circle cx="34" cy="20" r="8" fill="#d9cef7" />
                  <path d="M6 58 L34 28 L52 46 L68 30 L94 58 Z" fill="#d9cef7" />
                </svg>
              </div>
              <span className={`${styles.handle} ${styles.hTl}`} />
              <span className={`${styles.handle} ${styles.hTr}`} />
              <span className={`${styles.handle} ${styles.hBl}`} />
              <span className={`${styles.handle} ${styles.hBr}`} />
            </div>
          </div>

          {/* two stacked cards peeking from under the canvas */}
          <div className={styles.miniCards}>
            <div className={styles.miniCard}>
              <span className={styles.miniLine} />
              <span className={`${styles.miniLine} ${styles.miniShort}`} />
            </div>
            <div className={styles.miniCard}>
              <span className={styles.miniLine} />
              <span className={`${styles.miniLine} ${styles.miniShort}`} />
            </div>
          </div>

          {/* left tool rail */}
          <div className={styles.toolRail}>
            <div className={styles.railDots}>
              <span />
              <span />
            </div>
            {/* cursor */}
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 2.5l13 8.2-5.6 1-2.4 5.6z" />
            </svg>
            {/* square */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>
            {/* type */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 6h14M12 6v13" />
            </svg>
            {/* circle */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="7.5" />
            </svg>
            {/* grid */}
            <svg viewBox="0 0 24 24" fill="currentColor">
              <rect x="4.5" y="4.5" width="6" height="6" rx="1.4" />
              <rect x="13.5" y="4.5" width="6" height="6" rx="1.4" />
              <rect x="4.5" y="13.5" width="6" height="6" rx="1.4" />
              <rect x="13.5" y="13.5" width="6" height="6" rx="1.4" />
            </svg>
          </div>

          {/* foreground tile with the mark */}
          <div className={styles.heroTile}>
            <Mark size={76} />
          </div>
        </div>
      </div>

      {/* RIGHT — form */}
      <div className={styles.right}>
        <span className={`${styles.mobileSpark} ${styles.ms1}`} aria-hidden="true">
          <Spark size={18} color="#c4b5fd" />
        </span>
        <span className={`${styles.mobileSpark} ${styles.ms2}`} aria-hidden="true">
          <Spark size={24} color="#c4b5fd" />
        </span>

        <div className={styles.langRow}>
          <LanguagePicker label={t('login.language')} />
        </div>

        <div className={styles.formWrap}>
          <form className={styles.form} onSubmit={handleSubmit}>
            {/* Mobile-only brand lockup — the hero column is hidden on phones,
                so without this the mark would disappear entirely. */}
            <div className={styles.mobileBrand}>
              <Mark size={104} />
              <span className={styles.brandName}>
                Disen<span className={styles.brandNameAccent}>ia</span>
              </span>
              <span className={styles.brandTagline}>Your AI Design Copilot</span>
            </div>

            <h2 className={styles.title}>
              {copy.title}
              <span className={styles.titleSpark}>
                <Spark size={20} />
              </span>
            </h2>
            <p className={styles.lead}>{copy.lead}</p>

            {!CONFIGURED ? (
              <div className={`${styles.alert} ${styles.alertWarn}`}>
                {t('login.supabaseMissing', { file: ENV_FILE })}
              </div>
            ) : null}
            {error ? <div className={`${styles.alert} ${styles.alertError}`}>{error}</div> : null}
            {notice ? <div className={`${styles.alert} ${styles.alertOk}`}>{notice}</div> : null}

            {isSignup ? (
              <div className={styles.row}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="firstName">
                    {t('login.field.firstName')}
                  </label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputIcon}>{USER_ICON}</span>
                    <input
                      id="firstName"
                      className={styles.input}
                      type="text"
                      autoComplete="given-name"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="lastName">
                    {t('login.field.lastName')}
                  </label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputIcon}>{USER_ICON}</span>
                    <input
                      id="lastName"
                      className={styles.input}
                      type="text"
                      autoComplete="family-name"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">
                {t('login.field.email')}
              </label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>{MAIL_ICON}</span>
                <input
                  id="email"
                  className={styles.input}
                  type="email"
                  autoComplete="email"
                  required
                  placeholder={t('login.placeholder.email')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {mode !== 'reset' ? (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="password">
                  {t('login.field.password')}
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}>{LOCK_ICON}</span>
                  <input
                    id="password"
                    className={styles.input}
                    type={showPass ? 'text' : 'password'}
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    required
                    /* Length is checked in `handleSubmit`, not via `minLength`:
                       the native bubble speaks the browser's language, which
                       would contradict the locale the form is rendered in. */
                    placeholder="*********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? t('login.hidePassword') : t('login.showPassword')}
                  >
                    {showPass ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
                        <path d="M9.4 5.2A9 9 0 0121 12a15 15 0 01-2.2 3M6.3 6.3A15 15 0 003 12a9 9 0 0011 6.7" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ) : null}

            {isSignup ? (
              <>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="confirm">
                    {t('login.field.confirmPassword')}
                  </label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputIcon}>{LOCK_ICON}</span>
                    <input
                      id="confirm"
                      className={styles.input}
                      type={showPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      placeholder="*********"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="idNumber">
                    {t('login.field.idNumber')}
                    <span className={styles.optional}>{t('login.optional')}</span>
                  </label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputIcon}>{ID_ICON}</span>
                    <input
                      id="idNumber"
                      className={styles.input}
                      type="text"
                      inputMode="numeric"
                      placeholder={t('login.placeholder.idNumber')}
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="phone">
                    {t('login.field.phone')}
                    <span className={styles.optional}>{t('login.optional')}</span>
                  </label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputIcon}>{PHONE_ICON}</span>
                    <input
                      id="phone"
                      className={styles.input}
                      type="tel"
                      autoComplete="tel"
                      placeholder={t('login.placeholder.phone')}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.field}>
                  <label className={styles.label} htmlFor="gender">
                    {t('login.field.gender')}
                    <span className={styles.optional}>{t('login.optional')}</span>
                  </label>
                  <div className={styles.inputWrap}>
                    <span className={styles.inputIcon}>{GENDER_ICON}</span>
                    <select
                      id="gender"
                      className={`${styles.input} ${styles.select}`}
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                    >
                      <option value="">{t('login.gender.select')}</option>
                      <option value="female">{t('login.gender.female')}</option>
                      <option value="male">{t('login.gender.male')}</option>
                      <option value="non_binary">{t('login.gender.nonBinary')}</option>
                      <option value="other">{t('login.gender.other')}</option>
                      <option value="undisclosed">{t('login.gender.undisclosed')}</option>
                    </select>
                    <span className={styles.selectChevron} aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                  </div>
                </div>
              </>
            ) : null}

            {mode === 'signin' ? (
              <div className={styles.forgotRow}>
                <button type="button" className={styles.link} onClick={() => switchMode('reset')}>
                  {t('login.forgotPassword')}
                </button>
              </div>
            ) : null}

            <button type="submit" className={styles.submit} disabled={busy}>
              {busy ? (
                <span className={styles.spinner} />
              ) : (
                <>
                  <Spark size={18} color="#ffffff" />
                  {copy.cta}
                </>
              )}
            </button>

            <div className={styles.divider} />

            <div className={styles.switchRow}>
              {mode === 'signin' ? (
                <>
                  {t('login.noAccount')}{' '}
                  <button type="button" className={styles.link} onClick={() => switchMode('signup')}>
                    {t('login.createAccount')}
                  </button>
                </>
              ) : (
                <>
                  {t('login.haveAccount')}{' '}
                  <button type="button" className={styles.link} onClick={() => switchMode('signin')}>
                    {t('login.signIn')}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
