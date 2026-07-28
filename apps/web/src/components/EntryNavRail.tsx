// Lovart-style left navigation rail for the entry view.
//
// Renders a narrow icon-only column. The first slot is the brand logo,
// followed by the primary destinations users expect to keep in reach:
// New project, home, projects, brand kit, automations, plugins,
// and integrations. Footer controls are reserved for lower-frequency
// support affordances such as the help launcher.
// Language switching and other account-scoped controls live behind the
// floating settings cog in the top-right corner of the main content.

import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';
import { useT } from '../i18n';
import { LIBRARY_UI_VISIBLE } from '../features/libraryUi';

export type EntryView =
  | 'home'
  | 'onboarding'
  | 'projects'
  | 'tasks'
  | 'plugins'
  | 'design-systems'
  | 'library'
  | 'brands'
  | 'integrations';

interface Props {
  view: EntryView;
  onViewChange: (view: EntryView) => void;
  onNewProject: () => void;
  newProjectDisabled?: boolean;
  /** When false the rail is collapsed (hidden off-canvas) on the entry view. */
  open: boolean;
  /** Collapse the rail — called after a destination is chosen or the user dismisses it. */
  onClose: () => void;
  /** Footer account row — placeholder until wired to a real account source. */
  userName?: string;
  userAvatarUrl?: string;
  onSignOut?: () => void;
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]![0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]![0] ?? '' : '';
  return `${first}${last}`.toUpperCase();
}

interface NavButtonProps {
  active?: boolean;
  ariaLabel: string;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
  variant?: 'default' | 'primary';
  children: ReactNode;
}

function NavButton({ active, ariaLabel, tooltip, onClick, disabled, testId, children, variant }: NavButtonProps) {
  return (
    <button
      type="button"
      className={`entry-nav-rail__btn${active ? ' is-active' : ''}${variant === 'primary' ? ' entry-nav-rail__btn--primary' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-current={active ? 'page' : undefined}
      data-tooltip={tooltip}
      {...(testId ? { 'data-testid': testId } : {})}
    >
      <span className="entry-nav-rail__btn-icon" aria-hidden="true">{children}</span>
      <span className="entry-nav-rail__btn-label">{tooltip}</span>
    </button>
  );
}

export function EntryNavRail({
  view,
  onViewChange,
  onNewProject,
  newProjectDisabled = false,
  open,
  onClose,
  userName = 'Usuario',
  userAvatarUrl,
  onSignOut,
}: Props) {
  const t = useT();
  const brandLabel = t('app.brand');
  const homeLabel = t('entry.navHome');
  const isHome = view === 'home';

  // Once opened the rail stays docked (Manus-style); navigating between
  // destinations no longer collapses it.
  const selectView = (next: EntryView) => {
    onViewChange(next);
  };

  // While collapsed the rail is visually hidden but its logo + nav buttons
  // stay mounted. Mark the whole rail `inert` so those controls leave the
  // keyboard tab order and pointer flow entirely — otherwise a fresh Tab on
  // the home screen would land on invisible rail controls before the visible
  // toggle/hero. `inert` is set imperatively to stay compatible across React
  // versions whose JSX types don't yet declare the attribute.
  const railRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const node = railRef.current;
    if (!node) return;
    if (open) {
      node.removeAttribute('inert');
    } else {
      node.setAttribute('inert', '');
    }
  }, [open]);

  return (
    <nav
      ref={railRef}
      className={`entry-nav-rail${open ? ' is-open' : ''}`}
      aria-label="Primary"
      aria-hidden={open ? undefined : true}
    >
      <div className="entry-nav-rail__group">
        <div className="entry-nav-rail__brand">
          <button
            type="button"
            className="entry-nav-rail__logo"
            onClick={() => selectView('home')}
            aria-label={brandLabel}
            data-testid="entry-nav-logo"
          >
            <span
              className="entry-nav-rail__logo-img od-brand-glyph"
              aria-hidden="true"
            />
            <span className="entry-nav-rail__logo-name">{brandLabel}</span>
          </button>
          <button
            type="button"
            className="entry-nav-rail__collapse"
            onClick={onClose}
            aria-label={t('entry.navCollapse')}
            title={t('entry.navCollapse')}
            data-testid="entry-nav-collapse"
          >
            <Icon name="panel-left" size={20} />
          </button>
        </div>
        <div className="entry-nav-rail__logo-divider" role="separator" aria-hidden="true" />
        <NavButton
          ariaLabel={t('entry.navNewProject')}
          tooltip={t('entry.navNewProject')}
          onClick={onNewProject}
          disabled={newProjectDisabled}
          testId="entry-nav-new-project"
          variant="primary"
        >
          <Icon name="plus" size={18} />
        </NavButton>
        <NavButton
          active={isHome}
          ariaLabel={homeLabel}
          tooltip={homeLabel}
          onClick={() => selectView('home')}
          testId="entry-nav-home"
        >
          <Icon name="home" size={18} />
        </NavButton>
        <NavButton
          active={view === 'projects'}
          ariaLabel={t('entry.navProjects')}
          tooltip={t('entry.navProjects')}
          onClick={() => selectView('projects')}
          testId="entry-nav-projects"
        >
          <Icon name="folder" size={18} />
        </NavButton>
        <NavButton
          active={view === 'design-systems'}
          ariaLabel={t('entry.navDesignSystems')}
          tooltip={t('entry.navDesignSystems')}
          onClick={() => selectView('design-systems')}
          testId="entry-nav-design-systems"
        >
          <Icon name="palette" size={18} />
        </NavButton>
        {LIBRARY_UI_VISIBLE ? (
          <NavButton
            active={view === 'library'}
            ariaLabel="Library"
            tooltip="Library"
            onClick={() => selectView('library')}
            testId="entry-nav-library"
          >
            <Icon name="layers-filled" size={18} />
          </NavButton>
        ) : null}
        <NavButton
          active={view === 'tasks'}
          ariaLabel={t('entry.navTasks')}
          tooltip={t('entry.navTasks')}
          onClick={() => selectView('tasks')}
          testId="entry-nav-tasks"
        >
          <Icon name="kanban" size={18} />
        </NavButton>
        <NavButton
          active={view === 'plugins'}
          ariaLabel={t('entry.navPlugins')}
          tooltip={t('entry.navPlugins')}
          onClick={() => selectView('plugins')}
          testId="entry-nav-plugins"
        >
          <Icon name="grid" size={18} />
        </NavButton>
        <NavButton
          active={view === 'integrations'}
          ariaLabel={t('entry.navIntegrations')}
          tooltip={t('entry.navIntegrations')}
          onClick={() => selectView('integrations')}
          testId="entry-nav-integrations"
        >
          <Icon name="link" size={18} />
        </NavButton>
      </div>
      <div className="entry-nav-rail__footer">
        <div className="entry-nav-rail__user">
          {userAvatarUrl ? (
            <img
              className="entry-nav-rail__avatar"
              src={userAvatarUrl}
              alt=""
              aria-hidden="true"
            />
          ) : (
            <span
              className="entry-nav-rail__avatar entry-nav-rail__avatar--initials"
              aria-hidden="true"
            >
              {initialsFrom(userName)}
            </span>
          )}
          <span className="entry-nav-rail__user-name">{userName}</span>
        </div>
        <button
          type="button"
          className="entry-nav-rail__btn entry-nav-rail__signout"
          onClick={() => onSignOut?.()}
          data-testid="entry-nav-signout"
        >
          <span className="entry-nav-rail__btn-icon" aria-hidden="true">
            <Icon name="log-out" size={18} />
          </span>
          <span className="entry-nav-rail__btn-label">{t('settings.amrLogout')}</span>
        </button>
      </div>
    </nav>
  );
}
