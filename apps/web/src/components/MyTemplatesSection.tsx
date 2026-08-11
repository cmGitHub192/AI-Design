// "Mis plantillas" — a Home section, shown next to the Community gallery, that
// surfaces the user's own design templates (marked with `od.category:
// "mis-plantillas"` in their SKILL.md). Clicking Use starts a new project bound
// to that template.
//
// The card mirrors the community gallery tile on purpose: live preview, a Use
// action, then title + kind + copy. The preview is the template's own
// `example.html`, served by `GET /api/skills/:id/example` and rendered through
// the gallery's <HtmlSurface> so both surfaces share one scaled-iframe
// implementation instead of two.

import { useEffect, useRef, useState } from 'react';
import { Button } from '@open-design/components';

import type { SkillSummary } from '../types';
import type { Dict } from '../i18n/types';
import { useI18n, useT } from '../i18n';
import { localizeSkillDescription, localizeSkillName } from '../i18n/content';
import { HtmlSurface } from './plugins-home/cards/HtmlSurface';
import styles from './MyTemplatesSection.module.css';

interface Props {
  templates: SkillSummary[];
  onUse: (template: SkillSummary) => void;
}

/**
 * Which i18n key names what this template produces.
 *
 * Reuses the Examples gallery's vocabulary so a deck is called the same thing
 * in both places. Returns null for kinds with no established label rather than
 * inventing one — the pill is then omitted, which reads better than a raw slug.
 */
function kindLabelKey(template: SkillSummary): keyof Dict | null {
  switch (template.mode) {
    case 'deck':
      return 'examples.modeDeck';
    case 'prototype':
      return template.platform === 'mobile'
        ? 'examples.modePrototypeMobile'
        : 'examples.modePrototypeDesktop';
    case 'image':
      return 'examples.surfaceImage';
    case 'video':
      return 'examples.surfaceVideo';
    case 'audio':
      return 'examples.surfaceAudio';
    case 'template':
      return 'examples.modeDocument';
    case 'design-system':
      return 'entry.tabDesignSystems';
    default:
      return null;
  }
}

/** Mount the preview only once the card has been near the viewport. */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, inView };
}

function TemplateCard({ template, onUse }: { template: SkillSummary; onUse: () => void }) {
  const { locale } = useI18n();
  const t = useT();
  const { ref, inView } = useInView<HTMLDivElement>();

  const name = localizeSkillName(locale, template);
  const description = localizeSkillDescription(locale, template);
  const labelKey = kindLabelKey(template);

  return (
    <div className={styles.card} ref={ref}>
      {/* `data-mode` lets the stylesheet fit decks (16:9 stage) differently from
          page-shaped templates without branching in JS. */}
      <div className={styles.media} data-mode={template.mode}>
        <HtmlSurface
          preview={{
            kind: 'html',
            src: `/api/skills/${encodeURIComponent(template.id)}/example`,
            label: name,
            // The template's shipped example.html, not a baked plugin preview.
            source: 'example',
          }}
          pluginId={template.id}
          pluginTitle={name}
          inView={inView}
          eager
        />
      </div>
      <div className={styles.body}>
        <Button type="button" variant="primary" className={styles.use} onClick={onUse}>
          {t('pluginCard.use')}
        </Button>
        <div className={styles.titleRow}>
          <span className={styles.name} title={name}>
            {name}
          </span>
          {labelKey ? <span className={styles.pill}>{t(labelKey)}</span> : null}
        </div>
        {description ? <p className={styles.desc}>{description}</p> : null}
      </div>
    </div>
  );
}

export function MyTemplatesSection({ templates, onUse }: Props) {
  const t = useT();
  if (templates.length === 0) return null;
  return (
    <section className={styles.section} aria-label={t('myTemplates.title')}>
      <header className={styles.head}>
        <h2 className={styles.title}>{t('myTemplates.title')}</h2>
        <span className={styles.subtitle}>{t('myTemplates.subtitle')}</span>
      </header>
      <div className={styles.grid}>
        {templates.map((template) => (
          <TemplateCard key={template.id} template={template} onUse={() => onUse(template)} />
        ))}
      </div>
    </section>
  );
}
