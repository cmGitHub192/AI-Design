// Compact language selector for the entry topbar: a globe + short locale code
// trigger that opens a dropdown listing every Disenia locale. Switches the app
// language through the shared i18n context (persisted by useI18n's setLocale).

import { useEffect, useRef, useState } from 'react';
import { LOCALE_LABEL, LOCALES, useI18n } from '../i18n';
import { Icon } from './Icon';

function shortCode(locale: string): string {
  const region = locale.includes('-') ? locale.split('-')[1]! : locale;
  return region.slice(0, 2).toUpperCase();
}

export function EntryLanguagePicker() {
  const { locale, setLocale } = useI18n();
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

  return (
    <div className="entry-lang" ref={ref}>
      <button
        type="button"
        className="entry-lang__trigger"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={LOCALE_LABEL[locale]}
        data-testid="entry-language-trigger"
      >
        <Icon name="globe" size={16} />
        <span className="entry-lang__code">{shortCode(locale)}</span>
        <Icon name="chevron-down" size={13} />
      </button>
      {open ? (
        <div className="entry-lang__menu" role="listbox">
          {LOCALES.map((loc) => (
            <button
              key={loc}
              type="button"
              role="option"
              aria-selected={loc === locale}
              className={`entry-lang__item${loc === locale ? ' is-active' : ''}`}
              onClick={() => {
                setLocale(loc);
                setOpen(false);
              }}
            >
              <span className="entry-lang__item-code">{shortCode(loc)}</span>
              <span className="entry-lang__item-name">{LOCALE_LABEL[loc]}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
