import { LogOut, ChevronDown, Gavel } from 'lucide-react';
import { UserProfile, UserRole, JudgeHierarchyCode } from '../types/auth';
import { useState, useRef, useEffect } from 'react';
import { HIERARCHY_JUDGE_LOGINS } from '../services/auth';

interface HeaderProps {
  currentUser?: UserProfile | null;
  onLogout?: () => void;
  onSwitchPersona?: (role: UserRole) => void;
  onSwitchJudgeHierarchy?: (code: JudgeHierarchyCode) => void;
  onOpenPrivilegeMatrix?: () => void;
}

export function Header({ currentUser, onLogout, onSwitchPersona, onSwitchJudgeHierarchy, onOpenPrivilegeMatrix }: HeaderProps) {
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [fontSize, setFontSize] = useState<'standard' | 'large'>(() => {
    const saved = localStorage.getItem('ux4g-text-size');
    return saved === 'large' ? 'large' : 'standard';
  });

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync font size to html attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-font-size', fontSize);
    localStorage.setItem('ux4g-text-size', fontSize);
  }, [fontSize]);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    if (!showRoleDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowRoleDropdown(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowRoleDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showRoleDropdown]);

  const getRoleBadgeStyle = (role?: UserRole) => {
    switch (role) {
      case 'JUDGE':
        return 'bg-amber-100 text-amber-950 border-amber-300';
      case 'INVESTIGATING_OFFICER':
        return 'bg-indigo-100 text-indigo-950 border-indigo-300';
      case 'DLSA_OFFICER':
        return 'bg-emerald-100 text-emerald-950 border-emerald-300';
      case 'REGISTRY_CLERK':
      default:
        return 'bg-slate-100 text-slate-900 border-slate-300';
    }
  };

  const getRoleLabel = (role?: UserRole) => {
    switch (role) {
      case 'JUDGE':
        return currentUser?.judge_hierarchy ? `Judge (${currentUser.judge_hierarchy.toUpperCase()})` : 'Presiding Magistrate';
      case 'INVESTIGATING_OFFICER':
        return 'Investigating Officer';
      case 'DLSA_OFFICER':
        return 'DLSA Legal Aid Counsel';
      case 'REGISTRY_CLERK':
      default:
        return 'Registry / Notification Officer';
    }
  };

  return (
    <header className="py-2 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8 shrink-0 shadow-2xs relative z-30">
      {/* Brand & System */}
      <div className="flex items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm lg:text-base font-bold tracking-tight text-slate-950 font-display leading-none">RemindTrack</h1>
            <span className="text-[10px] px-1.5 py-0.2 font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300 rounded leading-none">
              BNSS 2023
            </span>
          </div>
          <p className="text-[10px] uppercase tracking-wider text-slate-600 font-bold leading-none mt-1">
            Subordinate Judiciary • Undertrial Compliance Portal
          </p>
        </div>
      </div>

      {/* Center / Right Controls: Accessibility Sizing + User Profile */}
      <div className="flex items-center gap-3">
        {/* GIGW 3.0 / UX4G 2-Step Text Sizer */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setFontSize('standard')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
              fontSize === 'standard' ? 'bg-white text-slate-950 shadow-xs border border-slate-300' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Standard Text Size"
          >
            A Standard
          </button>
          <button
            type="button"
            onClick={() => setFontSize('large')}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
              fontSize === 'large' ? 'bg-amber-400 text-slate-950 shadow-xs border border-amber-500 font-black' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Large Text Size (A+)"
          >
            A+ Large
          </button>
        </div>

        {/* User Persona & Role Switcher */}
        {currentUser && (
          <div className="relative z-50" ref={dropdownRef}>
            <button
              onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              className="py-1.5 px-3 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-2 shadow-2xs"
              title="Click to Switch Role or View Profile"
            >
              <span className="text-xs font-bold text-slate-950 truncate max-w-[240px] leading-none">
                {currentUser.name}
              </span>
              <span className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono leading-none shrink-0 ${getRoleBadgeStyle(currentUser.role)}`}>
                {getRoleLabel(currentUser.role)}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 shrink-0 ${showRoleDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Role Switcher Menu */}
            {showRoleDropdown && (
              <div className="absolute right-0 mt-2 w-84 bg-white rounded-xl shadow-2xl border border-slate-300 p-3 z-50 animate-in fade-in zoom-in-95 duration-100 [transform:translateZ(0)]">
                <div className="px-2 py-2 border-b border-slate-100 mb-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Current Session</p>
                  <p className="text-sm font-bold text-slate-950">{currentUser.name}</p>
                  <p className="text-xs text-slate-600 font-mono">{currentUser.department}</p>
                  <p className="text-xs text-indigo-950 font-mono mt-0.5 font-semibold">ID: {currentUser.badge_or_id}</p>
                </div>

                <p className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-900 bg-amber-50 rounded mb-2">
                  Switch Judicial Bench:
                </p>

                <div className="flex flex-col gap-1.5">
                  {(['jm-I', 'jm-II', 'jm-III', 'cjm'] as JudgeHierarchyCode[]).map((code) => {
                    const bench = HIERARCHY_JUDGE_LOGINS[code];
                    const isCurrent = currentUser.role === 'JUDGE' && currentUser.judge_hierarchy === code;
                    const isSupervisory = code === 'cjm';
                    return (
                      <button
                        key={code}
                        onClick={() => {
                          if (onSwitchJudgeHierarchy) {
                            onSwitchJudgeHierarchy(code);
                          } else if (onSwitchPersona) {
                            onSwitchPersona('JUDGE');
                          }
                          setShowRoleDropdown(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-colors shrink-0 ${
                          isCurrent
                            ? 'bg-amber-100 font-bold text-slate-950 border border-amber-400'
                            : 'hover:bg-slate-50 text-slate-800 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <Gavel className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-amber-700' : 'text-slate-500'}`} />
                          <div className="min-w-0 flex-1">
                            <p className="leading-tight font-semibold truncate">{bench.designation}</p>
                            <p className="text-[10px] text-slate-600 font-mono mt-0.5 font-medium">
                              {isSupervisory ? 'Supervisory • All Benches' : `Restricted • ${code.toUpperCase()} Only`}
                            </p>
                          </div>
                        </div>
                        {isCurrent && <span className="text-[10px] text-amber-950 font-bold uppercase bg-amber-200 px-2 py-0.5 rounded shrink-0 ml-2">Active</span>}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 mt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setShowRoleDropdown(false);
                      if (onLogout) onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>Sign Out from Bench</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

