'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

import styles from '../../login/login.module.css';

// Client-only for the same reason as the login screen: the locale comes from
// localStorage and the result comes from the URL fragment, neither of which
// the server can see. Server-rendering would emit English and then hydrate
// into the user's language.
const ConfirmScreen = dynamic(() => import('./ConfirmScreen'), {
  ssr: false,
  loading: () => <div className={styles.page} />,
});

export default function ConfirmPage(): ReactNode {
  return <ConfirmScreen />;
}
