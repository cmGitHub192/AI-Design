import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Fraunces, Manrope } from 'next/font/google';
import { I18nProvider } from '../src/i18n';
import { AnalyticsProvider } from '../src/analytics/provider';
import '@excalidraw/excalidraw/index.css';
import '../src/index.css';
import '../src/styles/home/index.css';

/**
 * Disenia's heading face. `next/font/google` fetches it at build time and
 * serves it from this origin, so the running app makes no request to Google
 * — the font is Google's, the delivery is ours. That keeps a self-hosted
 * install working offline and stops every viewer's IP reaching a third party.
 *
 * The CSS variable is what `--display` in tokens.css resolves against.
 */
const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
});

/**
 * Disenia's display serif — the wordmark and the marketing headlines on the
 * auth screen. Same self-hosted delivery rationale as Manrope above.
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fraunces',
});

export const metadata: Metadata = {
  title: 'Disenia',
  icons: {
    // SVG first so the mark stays crisp at every favicon size; the PNG is
    // the fallback for browsers that still refuse SVG icons.
    icon: [
      { url: '/app-icon.svg', type: 'image/svg+xml' },
      { url: '/app-icon.png' },
    ],
    apple: '/app-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#FCFAFF',
};

/**
 * Inline script that runs before React hydrates to apply the saved theme
 * preference without a flash of unstyled content. It reads the same
 * localStorage key used by `state/config.ts` and sets `data-theme` on
 * `<html>` immediately — before any CSS or React paint.
 * Keep the accent variable mix ratios in sync with `accentVars()` in
 * `src/state/appearance.ts`; this script cannot import application modules.
 */
const themeInitScript = `(function(){try{var c=JSON.parse(localStorage.getItem('open-design:config')||'{}');var t=c.theme;if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);var a=typeof c.accentColor==='string'&&/^#[0-9a-fA-F]{6}$/.test(c.accentColor.trim())?c.accentColor.trim().toLowerCase():'#7c3aed';var s=document.documentElement.style;s.setProperty('--accent',a);s.setProperty('--accent-strong','color-mix(in srgb, '+a+' 86%, var(--text-strong))');s.setProperty('--accent-soft','color-mix(in srgb, '+a+' 22%, var(--bg-panel))');s.setProperty('--accent-tint','color-mix(in srgb, '+a+' 12%, var(--bg-panel))');s.setProperty('--accent-hover','color-mix(in srgb, '+a+' 90%, var(--text-strong))');}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en' className={`${manrope.variable} ${fraunces.variable}`} suppressHydrationWarning>
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: intentional theme-init inline script to prevent FOUC */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body suppressHydrationWarning>
        <I18nProvider>
          <AnalyticsProvider>{children}</AnalyticsProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
