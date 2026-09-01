import { useState, useEffect, FormEvent } from 'react';
import { UserProfile, JudgeHierarchyCode, UserRole } from '../types/auth';
import { 
  loginWithHierarchyJudge, 
  loginWithPersona,
  loginWithCredentials,
  HIERARCHY_JUDGE_LOGINS,
  MOCK_PERSONAS
} from '../services/auth';
import { 
  ArrowRight, Lock, User, ShieldAlert, Sparkles, X, CheckCircle2
} from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Secret Quick-Login Panel toggle (Hidden by default; revealed via ^+Q+L or Ctrl+Q+L)
  const [showDevQuickLogin, setShowDevQuickLogin] = useState(false);

  // Keyboard shortcut listener:
  // 1. Typing 'demo' or 'quick' anywhere on the page (globally or in inputs)
  // 2. Pressing Option+L, Alt+L, or Ctrl+Shift+L
  useEffect(() => {
    let keyBuffer = '';
    let bufferTimer: any = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Shortcut combo: Ctrl+Shift+L or Option/Alt+L
      if ((e.ctrlKey && e.shiftKey && (e.key === 'l' || e.key === 'L')) || 
          (e.altKey && (e.key === 'l' || e.key === 'L'))) {
        e.preventDefault();
        setShowDevQuickLogin(prev => !prev);
        return;
      }

      // Track typing sequence 'demo' anywhere
      if (e.key && e.key.length === 1) {
        keyBuffer += e.key.toLowerCase();
        clearTimeout(bufferTimer);
        bufferTimer = setTimeout(() => { keyBuffer = ''; }, 1500);

        if (keyBuffer.includes('demo') || keyBuffer.includes('quick')) {
          setShowDevQuickLogin(prev => !prev);
          keyBuffer = '';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(bufferTimer);
    };
  }, []);

  const handleCredentialsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrorMsg('Please enter your Username / UID.');
      return;
    }
    if (!password.trim()) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const result = await loginWithCredentials(identifier, password);
      if (result.success && result.session) {
        onLoginSuccess(result.session.user);
      } else {
        setErrorMsg(result.error || 'Invalid credentials. Please verify your username and password.');
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Authentication error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDevQuickLogin = async (username: string, defaultPassword = 'password123') => {
    setIdentifier(username);
    setPassword(defaultPassword);
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const result = await loginWithCredentials(username, defaultPassword);
      if (result.success && result.session) {
        onLoginSuccess(result.session.user);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-900 flex flex-col justify-between selection:bg-slate-900 selection:text-white font-sans">
      
      {/* Official Government Portal Header */}
      <header className="py-3 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-12 shrink-0 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base lg:text-lg font-bold tracking-tight text-slate-950 font-display leading-none">
              RemindTrack
            </h1>
            <span className="text-[10px] px-1.5 py-0.2 font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300 rounded leading-none">
              BNSS 2023
            </span>
          </div>
          <p className="text-[10px] uppercase tracking-wider text-slate-600 font-bold leading-none mt-1">
            Subordinate Judiciary • Undertrial Compliance Portal
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[10.5px] text-emerald-900 font-mono font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
            BNSS 2023 Active
          </span>
          <span className="hidden sm:inline-flex items-center text-xs text-slate-600 font-mono border-l border-slate-200 pl-3">
            eCourts CIS 3.0 Standard
          </span>
        </div>
      </header>

      {/* Main Login Area: Clean, Centered Official Sign-In Form */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-300 shadow-sm p-6 sm:p-8 space-y-6">
          
          <div className="space-y-1 text-center sm:text-left border-b border-slate-100 pb-4">
            <h2 className="text-xl font-bold text-slate-950 font-display tracking-tight">
              Sign In to Your Workspace
            </h2>
            <p className="text-xs text-slate-600 font-medium">
              Enter your institutional credentials to access your statutory case docket.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 font-medium flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                Username / Judicial UID
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  autoFocus
                  value={identifier}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.toLowerCase().trim() === 'demo' || val.toLowerCase().endsWith('demo')) {
                      setShowDevQuickLogin(true);
                      setIdentifier('');
                      return;
                    }
                    setIdentifier(val);
                  }}
                  placeholder="e.g. jm-1, jm-2, jm-3, cjm, io-police..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 font-mono font-medium shadow-2xs"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 font-mono font-medium shadow-2xs"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Sign In to Workspace</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </>
              )}
            </button>
          </form>

          {/* Security & Protocol Notice */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-emerald-700" />
              eCourts CIS 3.0 Encrypted
            </span>
            <span className="text-slate-600 font-mono text-[10.5px]">Gov. of India • MoL&J</span>
          </div>
        </div>
      </main>

      {/* Secret Developer / Demo Quick-Login Panel (Revealed via ^ + Q + L) */}
      {showDevQuickLogin && (
        <div className="fixed bottom-12 right-6 z-50 bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-700 w-80 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Quick Login Presets</span>
            </div>
            <button 
              onClick={() => setShowDevQuickLogin(false)}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              title="Close shortcut drawer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-[11px] text-slate-400 mb-2.5">
            Press <code className="bg-slate-800 text-amber-300 px-1 py-0.2 rounded font-mono">Option + L</code> / <code className="bg-slate-800 text-amber-300 px-1 py-0.2 rounded font-mono">Ctrl + Shift + L</code> to toggle this panel.
          </p>

          <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
            <button
              onClick={() => handleDevQuickLogin('jm-1')}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-left cursor-pointer"
            >
              <strong className="text-amber-300 block text-[11px]">JM-I</strong>
              <span className="text-[10px] text-slate-400">jm-1</span>
            </button>
            <button
              onClick={() => handleDevQuickLogin('jm-2')}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-left cursor-pointer"
            >
              <strong className="text-amber-300 block text-[11px]">JM-II</strong>
              <span className="text-[10px] text-slate-400">jm-2</span>
            </button>
            <button
              onClick={() => handleDevQuickLogin('jm-3')}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-left cursor-pointer"
            >
              <strong className="text-amber-300 block text-[11px]">JM-III</strong>
              <span className="text-[10px] text-slate-400">jm-3</span>
            </button>
            <button
              onClick={() => handleDevQuickLogin('cjm')}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-left cursor-pointer"
            >
              <strong className="text-indigo-300 block text-[11px]">CJM</strong>
              <span className="text-[10px] text-slate-400">cjm</span>
            </button>
            <button
              onClick={() => handleDevQuickLogin('io-police')}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-left cursor-pointer"
            >
              <strong className="text-blue-300 block text-[11px]">IO Police</strong>
              <span className="text-[10px] text-slate-400">io-police</span>
            </button>
            <button
              onClick={() => handleDevQuickLogin('dlsa-counsel')}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-left cursor-pointer"
            >
              <strong className="text-emerald-300 block text-[11px]">DLSA Legal</strong>
              <span className="text-[10px] text-slate-400">dlsa-counsel</span>
            </button>
            <button
              onClick={() => handleDevQuickLogin('registry-clerk')}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 text-left cursor-pointer col-span-2"
            >
              <strong className="text-purple-300 block text-[11px]">Court Registry Officer</strong>
              <span className="text-[10px] text-slate-400">registry-clerk</span>
            </button>
          </div>
        </div>
      )}

      {/* Official Footer */}
      <footer 
        onDoubleClick={() => setShowDevQuickLogin(prev => !prev)}
        className="border-t border-slate-200 bg-white px-6 lg:px-12 py-2.5 text-slate-600 text-xs flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-2xs select-none"
      >
        <div className="flex items-center gap-3 text-[11px]">
          <span className="font-semibold text-slate-700">© 2026 RemindTrack Compliance Architecture</span>
          <span>•</span>
          <span className="cursor-default" title="Double click to toggle presets">Subordinate Courts Digitization Initiative</span>
        </div>
        <div className="text-[10.5px] text-slate-500">
          Secured for Judicial Magistrates, Investigating Officers, DLSA Counsel & Court Registry
        </div>
      </footer>
    </div>
  );
}
