import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

export interface RouteParams {
  caseId?: string;
  [key: string]: string | undefined;
}

interface RouterContextType {
  currentPath: string;
  params: RouteParams;
  queryParams: URLSearchParams;
  navigate: (to: string, replace?: boolean) => void;
}

const RouterContext = createContext<RouterContextType>({
  currentPath: '/',
  params: {},
  queryParams: new URLSearchParams(),
  navigate: () => {},
});

export function useRouter() {
  return useContext(RouterContext);
}

/**
 * Sanitize URL path and parameters to protect against XSS and directory traversal
 */
export function sanitizePath(raw: string): string {
  if (!raw) return '/';
  // Strip null bytes, script tags, protocol tricks
  let sanitized = raw.replace(/\0/g, '').replace(/<[^>]*>?/gm, '');
  if (!sanitized.startsWith('/')) {
    sanitized = '/' + sanitized;
  }
  // Eliminate multiple consecutive slashes
  return sanitized.replace(/\/+/g, '/');
}

/**
 * Extract dynamic parameters (e.g. /workspace/case/:caseId)
 */
function matchPath(pattern: string, path: string): { matches: boolean; params: RouteParams } {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return { matches: false, params: {} };
  }

  const params: RouteParams = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith(':')) {
      const paramName = patternPart.slice(1);
      params[paramName] = decodeURIComponent(pathPart);
    } else if (patternPart !== pathPart) {
      return { matches: false, params: {} };
    }
  }

  return { matches: true, params };
}

interface RouterProviderProps {
  children: ReactNode;
}

export function RouterProvider({ children }: RouterProviderProps) {
  const [currentPath, setCurrentPath] = useState<string>(() => sanitizePath(window.location.pathname));
  const [queryParams, setQueryParams] = useState<URLSearchParams>(() => new URLSearchParams(window.location.search));

  const navigate = useCallback((to: string, replace: boolean = false) => {
    const cleanTo = sanitizePath(to);
    if (replace) {
      window.history.replaceState(null, '', cleanTo);
    } else {
      window.history.pushState(null, '', cleanTo);
    }
    setCurrentPath(window.location.pathname);
    setQueryParams(new URLSearchParams(window.location.search));
  }, []);

  // Listen to browser Back/Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(sanitizePath(window.location.pathname));
      setQueryParams(new URLSearchParams(window.location.search));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Determine current active route params
  let matchedParams: RouteParams = {};
  if (currentPath.startsWith('/workspace/case/')) {
    const res = matchPath('/workspace/case/:caseId', currentPath);
    if (res.matches) {
      matchedParams = res.params;
    }
  }

  return (
    <RouterContext.Provider
      value={{
        currentPath,
        params: matchedParams,
        queryParams,
        navigate,
      }}
    >
      {children}
    </RouterContext.Provider>
  );
}

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  replace?: boolean;
}

export function Link({ to, replace, children, className, onClick, ...rest }: LinkProps) {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) onClick(e);
    if (!e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      navigate(to, replace);
    }
  };

  return (
    <a href={to} onClick={handleClick} className={className} {...rest}>
      {children}
    </a>
  );
}
