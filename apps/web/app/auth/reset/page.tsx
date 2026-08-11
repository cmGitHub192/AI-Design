'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

import styles from '../../login/login.module.css';

// Client-only: the recovery token lives in the URL fragment, which never
// reaches the server, and the locale comes from localStorage.
const ResetScreen = dynamic(() => import('./ResetScreen'), {
  ssr: false,
  loading: () => <div className={styles.page} />,
});

export default function ResetPage(): ReactNode {
  return <ResetScreen />;
}
