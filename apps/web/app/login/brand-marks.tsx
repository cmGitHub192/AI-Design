'use client';

import { useId, type ReactNode } from 'react';
import styles from './login.module.css';

// The Disenia logo and its decorative sparkle, shared by the auth screens
// (sign-in, email confirmation, password reset) so the brand is drawn from one
// definition rather than copied per page.

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
export function Mark({ size = 40 }: { size?: number }): ReactNode {
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
export function Spark({ size = 24, color = '#6c2eed' }: { size?: number; color?: string }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className={styles.sparkle}>
      <path
        d="M50 2 C54 33 67 46 98 50 C67 54 54 67 50 98 C46 67 33 54 2 50 C33 46 46 33 50 2Z"
        fill={color}
      />
    </svg>
  );
}
