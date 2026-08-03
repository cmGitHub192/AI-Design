// "Mis plantillas" — a Home section, shown next to the Community gallery, that
// surfaces the user's own design templates (marked with `od.category:
// "mis-plantillas"` in their SKILL.md). Clicking a card starts a new project
// bound to that template. Kept intentionally small and self-contained.

import type { CSSProperties } from 'react';
import type { SkillSummary } from '../types';
import { useI18n } from '../i18n';

interface Props {
  templates: SkillSummary[];
  onUse: (template: SkillSummary) => void;
}

const sectionStyle: CSSProperties = { margin: '6px 0 30px' };
const headStyle: CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 10, margin: '0 0 14px' };
const titleStyle: CSSProperties = { fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text)', margin: 0 };
const subStyle: CSSProperties = { fontSize: 13, color: 'var(--text-muted)' };
const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(min(260px, 100%), 1fr))',
  gap: 14,
};
const cardStyle: CSSProperties = {
  appearance: 'none',
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '18px 20px',
  borderRadius: 16,
  border: '1px solid var(--border)',
  background: 'var(--bg-panel)',
  cursor: 'pointer',
  transition: 'border-color 140ms var(--ease-out, ease), box-shadow 140ms var(--ease-out, ease), transform 140ms var(--ease-out, ease)',
};
const nameStyle: CSSProperties = { fontSize: 15, fontWeight: 700, color: 'var(--text)' };
const descStyle: CSSProperties = { fontSize: 13, lineHeight: 1.45, color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' };
const ctaStyle: CSSProperties = { marginTop: 'auto', paddingTop: 4, fontSize: 13, fontWeight: 600, color: 'var(--accent)' };

export function MyTemplatesSection({ templates, onUse }: Props) {
  const { locale } = useI18n();
  if (templates.length === 0) return null;
  const nameOf = (t: SkillSummary): string =>
    t.displayName?.[locale] ?? t.displayName?.en ?? t.name;
  return (
    <section style={sectionStyle} aria-label="Mis plantillas">
      <header style={headStyle}>
        <h2 style={titleStyle}>Mis plantillas</h2>
        <span style={subStyle}>Tus plantillas de diseño</span>
      </header>
      <div style={gridStyle}>
        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            style={cardStyle}
            onClick={() => onUse(template)}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <span style={nameStyle}>{nameOf(template)}</span>
            {template.description ? <span style={descStyle}>{template.description}</span> : null}
            <span style={ctaStyle}>Usar plantilla →</span>
          </button>
        ))}
      </div>
    </section>
  );
}
