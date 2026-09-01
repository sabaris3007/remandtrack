import { useRouter } from '../router/Router';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  const { currentPath, navigate } = useRouter();

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
        <span className="text-xs font-mono text-slate-500">
          eCourts CIS 3.0 Standard
        </span>
      </header>

      {/* Main 404 Notice */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-300 shadow-sm p-6 sm:p-8 space-y-5 text-center">
          <div className="w-12 h-12 bg-amber-50 rounded-full border border-amber-300 flex items-center justify-center mx-auto text-amber-700">
            <ShieldAlert className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <span className="text-xs font-mono font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded border border-amber-300">
              404 • JURISDICTION NOT FOUND
            </span>
            <h2 className="text-xl font-bold text-slate-950 font-display mt-2">
              Invalid Portal Route
            </h2>
            <p className="text-xs text-slate-600 font-medium">
              The requested statutory docket or judicial resource path does not exist on this server:
            </p>
            <div className="p-2 bg-slate-100 rounded-lg text-xs font-mono text-slate-800 break-all border border-slate-200 mt-2">
              {currentPath}
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => navigate('/workspace')}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-white" />
              <span>Return to Judicial Workspace</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 lg:px-12 py-2.5 text-slate-600 text-xs flex items-center justify-between shrink-0 shadow-2xs">
        <span className="text-[11px] text-slate-600">
          © 2026 RemindTrack Compliance Architecture • Subordinate Courts Digitization Initiative
        </span>
        <span className="text-[10px] font-mono text-slate-500">
          Gov. of India • MoL&J
        </span>
      </footer>
    </div>
  );
}
