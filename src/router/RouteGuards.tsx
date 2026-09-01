import React, { ReactNode, useEffect } from 'react';
import { useRouter } from './Router';
import { UserProfile } from '../types/auth';

interface ProtectedRouteProps {
  currentUser: UserProfile | null;
  children: ReactNode;
}

/**
 * Route guard that requires active authenticated judicial session.
 * Unauthenticated requests are immediately redirected to /login with original destination saved.
 */
export function ProtectedRoute({ currentUser, children }: ProtectedRouteProps) {
  const { currentPath, navigate } = useRouter();

  useEffect(() => {
    if (!currentUser) {
      const redirectTarget = encodeURIComponent(currentPath);
      navigate(`/login?redirect=${redirectTarget}`, true);
    }
  }, [currentUser, currentPath, navigate]);

  if (!currentUser) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-slate-100 text-slate-900">
        <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="w-8 h-8 border-3 border-slate-900 border-t-amber-500 rounded-full animate-spin"></div>
          <span className="text-xs font-mono font-medium text-slate-600">
            Authenticating Statutory Session...
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

interface PublicOnlyRouteProps {
  currentUser: UserProfile | null;
  children: ReactNode;
}

/**
 * Route guard for pages like /login.
 * If user is already authenticated, redirect straight to /workspace.
 */
export function PublicOnlyRoute({ currentUser, children }: PublicOnlyRouteProps) {
  const { navigate, queryParams } = useRouter();

  useEffect(() => {
    if (currentUser) {
      const redirectUrl = queryParams.get('redirect');
      const target = redirectUrl ? decodeURIComponent(redirectUrl) : '/workspace';
      navigate(target, true);
    }
  }, [currentUser, navigate, queryParams]);

  if (currentUser) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-slate-100 text-slate-900">
        <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="w-8 h-8 border-3 border-slate-900 border-t-amber-500 rounded-full animate-spin"></div>
          <span className="text-xs font-mono font-medium text-slate-600">
            Redirecting to Judicial Workspace...
          </span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
