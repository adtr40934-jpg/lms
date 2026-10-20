import { useEffect } from 'react';

export function usePageReady(isReady = true) {
  useEffect(() => {
    if (isReady && typeof window !== 'undefined' && window.hideGlobalLoader) {
      const timer = setTimeout(() => {
        window.hideGlobalLoader();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [isReady]);
}
