import { useCallback, useSyncExternalStore } from 'react';

import { getServerSnapshot } from './historyGridShared';

export function useViewportMatch(query: string) {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (
        typeof window === 'undefined' ||
        typeof window.matchMedia !== 'function'
      ) {
        return () => undefined;
      }

      const mediaQueryList = window.matchMedia(query);
      const handleChange = () => {
        callback();
      };

      if (typeof mediaQueryList.addEventListener === 'function') {
        mediaQueryList.addEventListener('change', handleChange);
        return () => mediaQueryList.removeEventListener('change', handleChange);
      }

      mediaQueryList.addListener(handleChange);
      return () => mediaQueryList.removeListener(handleChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return false;
    }

    return window.matchMedia(query).matches;
  }, [query]);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
