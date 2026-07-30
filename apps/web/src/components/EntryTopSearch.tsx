// Functional search for the entry topbar. Filters the user's projects by name
// as they type and shows a results dropdown; picking a result opens it, and
// Enter opens the top match (or runs the fallback, e.g. jump to Projects).

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '../types';
import { Icon } from './Icon';

interface Props {
  projects: Project[];
  placeholder: string;
  onOpenProject: (id: string) => void;
  /** Fallback when Enter is pressed with no match (e.g. open the Projects view). */
  onSubmitQuery?: (query: string) => void;
  emptyLabel?: string;
}

const MAX_RESULTS = 8;

export function EntryTopSearch({
  projects,
  placeholder,
  onOpenProject,
  onSubmitQuery,
  emptyLabel,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return projects
      .filter((project) => project.name.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_RESULTS);
  }, [projects, query]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && ref.current?.contains(event.target)) return;
      setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const showMenu = open && query.trim().length > 0;

  return (
    <div className="entry-search" ref={ref}>
      <span className="entry-search__icon" aria-hidden>
        <Icon name="search" size={16} />
      </span>
      <input
        type="text"
        className="entry-search__input"
        placeholder={placeholder}
        value={query}
        aria-label={placeholder}
        data-testid="entry-search-input"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            if (matches[0]) {
              onOpenProject(matches[0].id);
            } else {
              onSubmitQuery?.(query);
            }
            setOpen(false);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      {showMenu ? (
        <div className="entry-search__menu" role="listbox">
          {matches.length > 0 ? (
            matches.map((project) => (
              <button
                key={project.id}
                type="button"
                role="option"
                className="entry-search__item"
                onClick={() => {
                  onOpenProject(project.id);
                  setOpen(false);
                }}
              >
                <span className="entry-search__item-name">{project.name}</span>
              </button>
            ))
          ) : (
            <div className="entry-search__empty">{emptyLabel ?? 'Sin resultados'}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
