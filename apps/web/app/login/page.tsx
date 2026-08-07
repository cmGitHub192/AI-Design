'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import styles from './login.module.css';

/**
 * Like the rest of the product (see `app/[[...slug]]/client-app.tsx`), the auth
 * screen is client-only: the locale it renders in comes from localStorage and
 * `navigator.languages`, which the server cannot know. Server-rendering it
 * would emit English and then hydrate into the user's language — a hydration
 * mismatch that blanks and re-renders the tree.
 *
 * The fallback paints the page's own gradient so the swap reads as a load, not
 * a flash of empty white.
 */
const LoginScreen = dynamic(() => import('./LoginScreen'), {
  ssr: false,
  loading: () => <div className={styles.page} />,
});

export default function LoginPage(): ReactNode {
  return <LoginScreen />;
}
