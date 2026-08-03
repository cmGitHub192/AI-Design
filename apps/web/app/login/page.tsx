'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import styles from './login.module.css';

/**
 * Disenia auth screen.
 *
 * Talks to Supabase Auth (GoTrue) directly over its REST API with `fetch`, so
 * it needs no npm package (the workspace currently can't resolve new deps). The
 * session (access + refresh token) is stored client-side; app-wide gating and
 * daemon-side userId scoping are the next phase.
 *
 * Configure with apps/web/.env.local:
 *   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON);

const SESSION_KEY = 'disenia.session';

type Mode = 'signin' | 'signup' | 'reset';

function Sparkle({ size = 40, twoTone = false }: { size?: number; twoTone?: boolean }): ReactNode {
  const star = 'M50 2 C54 33 67 46 98 50 C67 54 54 67 50 98 C46 67 33 54 2 50 C33 46 46 33 50 2Z';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path d={star} fill="#7c3aed" />
      {twoTone ? (
        <path
          d="M50 26 C52 42 58 48 74 50 C58 52 52 58 50 74 C48 58 42 52 26 50 C42 48 48 42 50 26Z"
          fill="#f6a623"
        />
      ) : null}
    </svg>
  );
}

async function gotrue(path: string, body: Record<string, unknown>): Promise<Record<string, any>> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error_description || data.msg || data.error || 'Algo salió mal. Inténtalo de nuevo.';
    throw new Error(String(msg));
  }
  return data;
}

export default function LoginPage(): ReactNode {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const copy = {
    signin: {
      title: 'Bienvenido de nuevo',
      lead: 'Inicia sesión para continuar diseñando con Disenia.',
      cta: 'Iniciar sesión',
    },
    signup: {
      title: 'Crea tu cuenta',
      lead: 'Empieza a diseñar con IA en minutos.',
      cta: 'Crear cuenta',
    },
    reset: {
      title: 'Recupera tu acceso',
      lead: 'Te enviamos un enlace para restablecer tu contraseña.',
      cta: 'Enviar enlace',
    },
  }[mode];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!CONFIGURED) {
      setError('Supabase aún no está configurado (falta NEXT_PUBLIC_SUPABASE_URL / ANON_KEY).');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'reset') {
        await gotrue('recover', { email });
        setNotice('Si el correo existe, te enviamos un enlace para restablecer la contraseña.');
      } else if (mode === 'signup') {
        const data = await gotrue('signup', { email, password });
        if (data.access_token) {
          persistSession(data);
          window.location.assign('/');
          return;
        }
        setNotice('Cuenta creada. Revisa tu correo para confirmar la cuenta y luego inicia sesión.');
        setMode('signin');
      } else {
        const data = await gotrue('token?grant_type=password', { email, password });
        persistSession(data);
        window.location.assign('/');
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado.');
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

  return (
    <div className={styles.page}>
      {/* LEFT — brand + hero */}
      <div className={styles.left}>
        <div className={styles.brand}>
          <Sparkle size={54} twoTone />
          <div className={styles.brandText}>
            <span className={styles.brandName}>Disenia</span>
            <span className={styles.brandTagline}>Your AI Design Copilot</span>
          </div>
        </div>

        <h1 className={styles.headline}>
          Convierte ideas
          <br />
          en experiencias
          <br />
          <span className={styles.headlineAccent}>extraordinarias.</span>
        </h1>

        <p className={styles.subtitle}>
          Disenia es tu copiloto de diseño con IA. Crea interfaces, wireframes y
          productos digitales más rápido que nunca.
        </p>

        <div className={styles.illustration} aria-hidden="true">
          <Sparkle size={30} />
          <span className={`${styles.floatSpark} ${styles.s1}`}>
            <Sparkle size={26} twoTone />
          </span>
          <span className={`${styles.floatSpark} ${styles.s2}`}>
            <Sparkle size={36} />
          </span>

          <div className={`${styles.wireWindow} ${styles.wireBack}`}>
            <div className={styles.wireDots}>
              <span />
              <span />
              <span />
            </div>
            <div className={styles.imgPlaceholder}>
              <svg width="46" height="30" viewBox="0 0 46 30" fill="none">
                <circle cx="14" cy="10" r="4" fill="#c9bcf3" />
                <path d="M2 28 L16 14 L26 24 L34 16 L44 28 Z" fill="#c9bcf3" />
              </svg>
            </div>
            <div className={styles.wireLine} />
            <div className={`${styles.wireLine} ${styles.short}`} />
          </div>

          <div className={styles.toolRail}>
            {/* cursor */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 3l7 17 2-7 7-2z" />
            </svg>
            {/* square */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="4" width="16" height="16" rx="2" />
            </svg>
            {/* type */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 6h14M12 6v13" />
            </svg>
            {/* circle */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="8" />
            </svg>
            {/* grid */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="4" width="7" height="7" rx="1" />
              <rect x="13" y="4" width="7" height="7" rx="1" />
              <rect x="4" y="13" width="7" height="7" rx="1" />
              <rect x="13" y="13" width="7" height="7" rx="1" />
            </svg>
          </div>

          <div className={styles.heroTile}>
            <Sparkle size={64} twoTone />
          </div>
        </div>
      </div>

      {/* RIGHT — form */}
      <div className={styles.right}>
        <div className={styles.langRow}>
          <button type="button" className={styles.langBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
            </svg>
            Español
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>

        <div className={styles.formWrap}>
          <form className={styles.form} onSubmit={handleSubmit}>
            <h2 className={styles.title}>
              {copy.title}
              <Sparkle size={26} twoTone />
            </h2>
            <p className={styles.lead}>{copy.lead}</p>

            {!CONFIGURED ? (
              <div className={`${styles.alert} ${styles.alertWarn}`}>
                Supabase todavía no está conectado. Añade tus claves en{' '}
                <code>apps/web/.env.local</code> para activar el login.
              </div>
            ) : null}
            {error ? <div className={`${styles.alert} ${styles.alertError}`}>{error}</div> : null}
            {notice ? <div className={`${styles.alert} ${styles.alertOk}`}>{notice}</div> : null}

            <div className={styles.field}>
              <label className={styles.label} htmlFor="email">
                Correo electrónico
              </label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 7l9 6 9-6" />
                  </svg>
                </span>
                <input
                  id="email"
                  className={styles.input}
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="tu@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            {mode !== 'reset' ? (
              <div className={styles.field}>
                <label className={styles.label} htmlFor="password">
                  Contraseña
                </label>
                <div className={styles.inputWrap}>
                  <span className={styles.inputIcon}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="5" y="11" width="14" height="10" rx="2" />
                      <path d="M8 11V7a4 4 0 018 0v4" />
                    </svg>
                  </span>
                  <input
                    id="password"
                    className={styles.input}
                    type={showPass ? 'text' : 'password'}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    required
                    placeholder="•••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className={styles.eyeBtn}
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPass ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
                        <path d="M9.4 5.2A9 9 0 0121 12a15 15 0 01-2.2 3M6.3 6.3A15 15 0 003 12a9 9 0 0011 6.7" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ) : null}

            {mode === 'signin' ? (
              <div className={styles.forgotRow}>
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => {
                    setMode('reset');
                    setError(null);
                    setNotice(null);
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            ) : null}

            <button type="submit" className={styles.submit} disabled={busy}>
              {busy ? (
                <span className={styles.spinner} />
              ) : (
                <>
                  <Sparkle size={18} />
                  {copy.cta}
                </>
              )}
            </button>

            <div className={styles.divider} />

            <div className={styles.switchRow}>
              {mode === 'signin' ? (
                <>
                  ¿No tienes una cuenta?{' '}
                  <button
                    type="button"
                    className={styles.link}
                    onClick={() => {
                      setMode('signup');
                      setError(null);
                      setNotice(null);
                    }}
                  >
                    Crear cuenta
                  </button>
                </>
              ) : (
                <>
                  ¿Ya tienes cuenta?{' '}
                  <button
                    type="button"
                    className={styles.link}
                    onClick={() => {
                      setMode('signin');
                      setError(null);
                      setNotice(null);
                    }}
                  >
                    Iniciar sesión
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
