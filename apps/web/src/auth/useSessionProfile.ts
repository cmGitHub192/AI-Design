import { useEffect, useState } from 'react';

import { readStoredSession, sessionProfile, SESSION_KEY, type SessionProfile } from './session';

/**
 * The signed-in identity, or null when nobody is signed in.
 *
 * Reads on mount rather than during render so the value is stable for SSR/static
 * export (there is no localStorage at build time) and so a sign-out in another
 * tab propagates here through the `storage` event.
 */
export function useSessionProfile(): SessionProfile | null {
  const [profile, setProfile] = useState<SessionProfile | null>(null);

  useEffect(() => {
    setProfile(sessionProfile(readStoredSession()));

    function handleStorage(event: StorageEvent) {
      if (event.key !== null && event.key !== SESSION_KEY) return;
      setProfile(sessionProfile(readStoredSession()));
    }
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return profile;
}
