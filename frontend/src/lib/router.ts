// src/lib/router.ts
import { useEffect, useState } from 'react';

export type Route = '/' | '/pacts' | '/treasury' | '/docs';

const VALID: Route[] = ['/', '/pacts', '/treasury', '/docs'];

function readHash(): Route {
  const raw = window.location.hash.replace(/^#/, '');
  return (VALID as string[]).includes(raw) ? (raw as Route) : '/';
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => readHash());

  useEffect(() => {
    const onHashChange = () => setRoute(readHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return route;
}
