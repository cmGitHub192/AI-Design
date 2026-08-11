'use client';

import type { ReactNode } from 'react';

import { Mark, Spark } from '../login/brand-marks';
import styles from '../login/login.module.css';
import landing from './auth-landing.module.css';

// Chrome shared by the email-link landing pages (/auth/confirm, /auth/reset).
//
// These pages are the second half of a flow that started on the login screen,
// so they reuse its stylesheet and brand lockup: arriving from an email should
// feel like coming back to the same product, not landing on a stray page.
// The marketing hero column is deliberately dropped — someone acting on an
// email link has already decided; a pitch would be noise.

interface Props {
  title: string;
  lead: string;
  /** Rendered above the children, in the same slot the login form uses. */
  alert?: { tone: 'error' | 'ok'; message: string } | null;
  children?: ReactNode;
}

/**
 * The single call-to-action these pages end on.
 *
 * It is a link, not a button: every path from here leads back to /login, and a
 * real anchor keeps middle-click, "open in new tab" and keyboard activation
 * working for free.
 */
export function AuthLandingAction({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}): ReactNode {
  return (
    <a className={`${styles.submit} ${landing.action}`} href={href}>
      {children}
    </a>
  );
}

export function AuthLandingShell({ title, lead, alert, children }: Props): ReactNode {
  return (
    <div className={styles.page}>
      <div className={`${styles.right} ${landing.card}`}>
        <div className={`${styles.formWrap} ${landing.body}`}>
          <Mark size={72} />

          <h2 className={styles.title}>
            {title}
            <span className={styles.titleSpark}>
              <Spark size={20} />
            </span>
          </h2>
          <p className={styles.lead}>{lead}</p>

          {alert ? (
            <div
              className={`${styles.alert} ${alert.tone === 'error' ? styles.alertError : styles.alertOk}`}
            >
              {alert.message}
            </div>
          ) : null}

          {children}
        </div>
      </div>
    </div>
  );
}
