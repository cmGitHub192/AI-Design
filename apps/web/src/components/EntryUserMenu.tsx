// Account menu opened from the topbar avatar: shows the signed-in identity
// (avatar, greeting, and the profile fields captured at sign-up) plus the
// account actions — Configuración (opens Settings) and Cerrar Sesión.
//
// Identity comes from the Supabase session via `useSessionProfile`; EntryShell
// passes it down. Field labels reuse the existing `login.field.*` dictionary so
// the menu names things exactly like the form that collected them, in all
// supported locales.

import { useEffect, useRef, useState } from 'react';
import { useT } from '../i18n';
import { Icon } from './Icon';

interface Props {
  userName?: string;
  userEmail?: string;
  userRole?: string;
  userAvatarUrl?: string;
  /** Raw `user_metadata` values from Supabase; omitted when never filled in. */
  idNumber?: string;
  phone?: string;
  gender?: string;
  onOpenSettings: () => void;
  onSignOut?: () => void;
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]![0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]![0] ?? '' : '';
  return `${first}${last}`.toUpperCase();
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Gender is stored as a bare token; map it back to the form's own wording. */
const GENDER_LABEL_KEYS = {
  female: 'login.gender.female',
  male: 'login.gender.male',
  'non-binary': 'login.gender.nonBinary',
  other: 'login.gender.other',
  undisclosed: 'login.gender.undisclosed',
} as const;

export function EntryUserMenu({
  userName = 'Usuario',
  userEmail,
  userRole,
  userAvatarUrl,
  idNumber,
  phone,
  gender,
  onOpenSettings,
  onSignOut,
}: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && ref.current?.contains(event.target)) return;
      setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  // Only fields the account actually has: an empty row would read as missing
  // data rather than as a field the user chose to skip at sign-up. Email is
  // deliberately absent — the popover header already shows it.
  const genderKey = gender ? GENDER_LABEL_KEYS[gender as keyof typeof GENDER_LABEL_KEYS] : undefined;
  const details: Array<{ label: string; value: string }> = [
    { label: t('login.field.idNumber'), value: idNumber ?? '' },
    { label: t('login.field.phone'), value: phone ?? '' },
    { label: t('login.field.gender'), value: genderKey ? t(genderKey) : gender ?? '' },
  ].filter((row) => row.value !== '');

  const avatar = userAvatarUrl ? (
    <img src={userAvatarUrl} alt="" />
  ) : (
    <span className="entry-user__initials">{initialsFrom(userName)}</span>
  );

  return (
    <div className="entry-user" ref={ref}>
      <button
        type="button"
        className="entry-user__trigger"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={userName}
        data-testid="entry-user-trigger"
      >
        <span className="entry-user__avatar">{avatar}</span>
        <span className="entry-user__dot" aria-hidden />
      </button>
      {open ? (
        <div className="entry-user__popover" role="menu">
          <div className="entry-user__head">
            {userEmail ? <span className="entry-user__email">{userEmail}</span> : <span />}
            <button
              type="button"
              className="entry-user__close"
              onClick={() => setOpen(false)}
              aria-label={t('common.close')}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
          <div className="entry-user__body">
            <span className="entry-user__avatar entry-user__avatar--lg">
              {avatar}
              <span className="entry-user__dot entry-user__dot--lg" aria-hidden />
            </span>
            <span className="entry-user__greeting">¡Hola, {firstNameOf(userName)}!</span>
            {userRole ? <span className="entry-user__role">{userRole}</span> : null}
          </div>
          {details.length > 0 ? (
            <dl className="entry-user__details">
              {details.map(({ label, value }) => (
                <div className="entry-user__detail" key={label}>
                  <dt className="entry-user__detail-label">{label}</dt>
                  <dd className="entry-user__detail-value">{value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className="entry-user__actions">
            <button
              type="button"
              className="entry-user__action"
              onClick={() => {
                setOpen(false);
                onOpenSettings();
              }}
            >
              <Icon name="settings" size={15} />
              <span>Configuración</span>
            </button>
            <button
              type="button"
              className="entry-user__action entry-user__action--danger"
              onClick={() => {
                setOpen(false);
                onSignOut?.();
              }}
            >
              <Icon name="log-out" size={15} />
              <span>{t('settings.amrLogout')}</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
