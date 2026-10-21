import { useState, useEffect, useCallback } from 'react';

export type ComponentTarget = 'CMP-PUB-001' | 'CMP-FAR-001' | 'CMP-KIO-001';

function resolveComponentFromUrl(): ComponentTarget {
  if (typeof window === 'undefined') return 'CMP-PUB-001';

  const searchParams = new URLSearchParams(window.location.search);
  const token = [
    searchParams.get('component'),
    searchParams.get('cmp'),
    searchParams.get('view'),
    window.location.hash,
    window.location.pathname,
  ]
    .filter(Boolean)
    .join(' ')
    .toUpperCase();

  if (token.includes('FAR') || token.includes('CONSOLA')) return 'CMP-FAR-001';
  if (token.includes('KIO') || token.includes('KIOSKO')) return 'CMP-KIO-001';
  return 'CMP-PUB-001';
}

export function useComponentRouter() {
  const [activeComponent, setActiveComponent] = useState<ComponentTarget>(resolveComponentFromUrl);

  const navigateTo = useCallback((target: ComponentTarget) => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', target);
    window.history.pushState({}, '', url);
    setActiveComponent(target);
  }, []);

  useEffect(() => {
    const syncFromUrl = () => setActiveComponent(resolveComponentFromUrl());
    window.addEventListener('hashchange', syncFromUrl);
    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncFromUrl);
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, []);

  return { activeComponent, navigateTo };
}
