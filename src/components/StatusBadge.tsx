import { ComplianceStatus } from '../types/case';

interface StatusBadgeProps {
  status: ComplianceStatus;
  variant?: 'pill' | 'bar';
}

export function StatusBadge({ status, variant = 'pill' }: StatusBadgeProps) {
  if (variant === 'bar') {
    switch (status) {
      case 'RED':
        return (
          <div className="w-14 sm:w-16 h-7 sm:h-8 rounded-r-lg bg-red-600 border-y border-r border-red-700 text-white flex items-center justify-center font-bold font-mono text-[10.5px] sm:text-xs tracking-wider uppercase shadow-xs">
            RED
          </div>
        );
      case 'ORANGE':
        return (
          <div className="w-14 sm:w-16 h-7 sm:h-8 rounded-r-lg bg-orange-500 border-y border-r border-orange-600 text-white flex items-center justify-center font-bold font-mono text-[10.5px] sm:text-xs tracking-wider uppercase shadow-xs">
            ORANGE
          </div>
        );
      case 'AMBER':
        return (
          <div className="w-14 sm:w-16 h-7 sm:h-8 rounded-r-lg bg-amber-400 border-y border-r border-amber-500 text-slate-950 flex items-center justify-center font-black font-mono text-[10.5px] sm:text-xs tracking-wider uppercase shadow-xs">
            AMBER
          </div>
        );
      case 'NORMAL':
      default:
        return (
          <div className="w-14 sm:w-16 h-7 sm:h-8 rounded-r-lg bg-slate-500 border-y border-r border-slate-600 text-white flex items-center justify-center font-bold font-mono text-[10.5px] sm:text-xs tracking-wider uppercase shadow-xs">
            NORMAL
          </div>
        );
    }
  }

  switch (status) {
    case 'RED':
      return (
        <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 bg-red-600 text-white font-bold rounded-md text-[11px] tracking-wider uppercase whitespace-nowrap shadow-2xs border border-red-700">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0"></span>
          RED ALERT
        </span>
      );
    case 'ORANGE':
      return (
        <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 bg-orange-500 text-white font-bold rounded-md text-[11px] tracking-wider uppercase whitespace-nowrap shadow-2xs border border-orange-600">
          <span className="w-1.5 h-1.5 rounded-full bg-white shrink-0"></span>
          ORANGE ALERT
        </span>
      );
    case 'AMBER':
      return (
        <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 bg-amber-400 text-slate-950 font-bold rounded-md text-[11px] tracking-wider uppercase whitespace-nowrap shadow-2xs border border-amber-500 font-black">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-950 shrink-0"></span>
          AMBER ALERT
        </span>
      );
    case 'NORMAL':
    default:
      return (
        <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-800 font-bold rounded-md text-[11px] tracking-wider uppercase whitespace-nowrap border border-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>
          NORMAL
        </span>
      );
  }
}



