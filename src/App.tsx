import { useState, useEffect } from 'react';
import { RouterProvider, useRouter } from './router/Router';
import { ProtectedRoute, PublicOnlyRoute } from './router/RouteGuards';
import { CauseListModule } from './components/CauseListModule';
import { LoginScreen } from './components/LoginScreen';
import { NotFoundPage } from './components/NotFoundPage';
import { UserProfile, UserRole, JudgeHierarchyCode } from './types/auth';
import { getActiveSession, clearSession, loginWithPersona, loginWithHierarchyJudge } from './services/auth';

function MainAppRoutes() {
  const { currentPath, navigate } = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const session = getActiveSession();
    if (session && session.user) {
      setCurrentUser(session.user);
    }
    setIsInitializing(false);
  }, []);

  // Sync root '/' path to appropriate destination
  useEffect(() => {
    if (!isInitializing && currentPath === '/') {
      if (currentUser) {
        navigate('/workspace', true);
      } else {
        navigate('/login', true);
      }
    }
  }, [isInitializing, currentPath, currentUser, navigate]);

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    const searchParams = new URLSearchParams(window.location.search);
    const redirectUrl = searchParams.get('redirect');
    navigate(redirectUrl ? decodeURIComponent(redirectUrl) : '/workspace', true);
  };

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    navigate('/login', true);
  };

  const handleSwitchPersona = async (role: UserRole) => {
    const session = await loginWithPersona(role);
    setCurrentUser(session.user);
  };

  const handleSwitchJudgeHierarchy = async (code: JudgeHierarchyCode) => {
    const session = await loginWithHierarchyJudge(code);
    setCurrentUser(session.user);
  };

  if (isInitializing) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-slate-100 text-slate-900">
        <div className="flex flex-col items-center gap-3 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
          <div className="w-8 h-8 border-3 border-slate-900 border-t-amber-500 rounded-full animate-spin"></div>
          <span className="text-xs font-mono font-medium text-slate-600">
            Initializing RemindTrack Security Subsystem...
          </span>
        </div>
      </div>
    );
  }

  // Route 1: /login
  if (currentPath === '/login') {
    return (
      <PublicOnlyRoute currentUser={currentUser}>
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </PublicOnlyRoute>
    );
  }

  // Route 2: /workspace, /workspace/case/:caseId, /audit
  if (
    currentPath === '/workspace' || 
    currentPath.startsWith('/workspace/case/') || 
    currentPath === '/audit'
  ) {
    return (
      <ProtectedRoute currentUser={currentUser}>
        <div className="w-screen h-screen overflow-hidden bg-slate-100">
          <CauseListModule
            courtTitle={currentUser?.role === 'JUDGE' ? (currentUser.department || 'Court of Judicial Magistrate') : 'Undertrial Compliance Portal'}
            showHeader={true}
            currentUser={currentUser}
            onLogout={handleLogout}
            onSwitchPersona={handleSwitchPersona}
            onSwitchJudgeHierarchy={handleSwitchJudgeHierarchy}
          />
        </div>
      </ProtectedRoute>
    );
  }

  // Route 3: Wildcard / Unknown path -> 404 Institutional Page Not Found
  return <NotFoundPage />;
}

export default function App() {
  return (
    <RouterProvider>
      <MainAppRoutes />
    </RouterProvider>
  );
}
