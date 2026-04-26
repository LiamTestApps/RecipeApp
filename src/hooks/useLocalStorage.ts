import { useEffect, useState } from 'react';

/**
 * Like `useState`, but the value is mirrored to localStorage so it
 * persists across reloads. Used for UI preferences only — never for
 * domain data (which lives in IndexedDB).
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Quota exceeded or storage disabled — silently ignore. The user's
      // preference simply won't persist this session.
    }
  }, [key, value]);

  return [value, setValue];
}
