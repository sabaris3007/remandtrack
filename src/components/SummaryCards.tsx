import { ComplianceStatus } from '../types/case';
import { Filter, Check } from 'lucide-react';

interface SummaryCardsProps {
  total: number;
  normal: number;
  amber: number;
  orange: number;
  red: number;
  activeFilter: ComplianceStatus | 'ALL';
  onSelectFilter: (filter: ComplianceStatus | 'ALL') => void;
}

export function SummaryCards({ 
  total, 
  normal, 
  amber, 
  orange, 
  red, 
  activeFilter, 
  onSelectFilter 
}: SummaryCardsProps) {
  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 px-6 lg:px-8 py-2.5 shrink-0 bg-white border-b border-slate-200 shadow-2xs">
      {/* Total Active */}
      <button
        type="button"
        onClick={() => onSelectFilter('ALL')}
        className={`group text-left py-2 px-3 sm:py-2.5 sm:px-3.5 border rounded-xl transition-all cursor-pointer relative ${
          activeFilter === 'ALL'
            ? 'bg-slate-100 border-slate-500 ring-2 ring-slate-800/15 shadow-sm'
            : 'bg-slate-50/90 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Total Active</p>
          {activeFilter === 'ALL' ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-800 bg-white px-1.5 py-0.2 rounded border border-slate-300 shadow-2xs">
              <Check className="w-2.5 h-2.5 text-slate-900" /> Active
            </span>
          ) : (
            <Filter className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
        <p className="text-xl sm:text-2xl font-bold text-slate-950 font-mono tracking-tight mt-0.5">{total}</p>
        <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
          All cause-list matters (≤ 3y)
        </p>
      </button>

      {/* Normal */}
      <button
        type="button"
        onClick={() => onSelectFilter(activeFilter === 'NORMAL' ? 'ALL' : 'NORMAL')}
        className={`group text-left py-2 px-3 sm:py-2.5 sm:px-3.5 border border-l-4 rounded-xl transition-all cursor-pointer relative ${
          activeFilter === 'NORMAL'
            ? 'bg-slate-100 border-slate-400 border-l-slate-700 ring-2 ring-slate-400/25 shadow-sm'
            : 'bg-slate-50/90 border-slate-200 border-l-slate-400 hover:bg-slate-100 hover:border-slate-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Normal</p>
          {activeFilter === 'NORMAL' && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-800 bg-white px-1.5 py-0.2 rounded border border-slate-300 shadow-2xs">
              <Check className="w-2.5 h-2.5 text-slate-900" /> Active
            </span>
          )}
        </div>
        <p className="text-xl sm:text-2xl font-bold text-slate-950 font-mono tracking-tight mt-0.5">{normal}</p>
        <p className="text-[11px] text-slate-600 font-medium truncate mt-0.5">
          Within statutory timelines
        </p>
      </button>

      {/* Amber Alert */}
      <button
        type="button"
        onClick={() => onSelectFilter(activeFilter === 'AMBER' ? 'ALL' : 'AMBER')}
        className={`group text-left py-2 px-3 sm:py-2.5 sm:px-3.5 border border-l-4 rounded-xl transition-all cursor-pointer relative ${
          activeFilter === 'AMBER'
            ? 'bg-amber-100/90 border-amber-400 border-l-amber-600 ring-2 ring-amber-500/25 shadow-sm'
            : 'bg-amber-50/80 border-amber-200 border-l-amber-500 hover:bg-amber-100/60 hover:border-amber-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-amber-950 uppercase tracking-wider">Amber Alert</p>
          {activeFilter === 'AMBER' && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-950 bg-white px-1.5 py-0.2 rounded border border-amber-300 shadow-2xs">
              <Check className="w-2.5 h-2.5 text-amber-800" /> Active
            </span>
          )}
        </div>
        <p className="text-xl sm:text-2xl font-bold text-amber-950 font-mono tracking-tight mt-0.5">{amber}</p>
        <p className="text-[11px] text-amber-950 font-medium truncate mt-0.5">
          Day 90 chargesheet / bail window
        </p>
      </button>

      {/* Orange Alert */}
      <button
        type="button"
        onClick={() => onSelectFilter(activeFilter === 'ORANGE' ? 'ALL' : 'ORANGE')}
        className={`group text-left py-2 px-3 sm:py-2.5 sm:px-3.5 border border-l-4 rounded-xl transition-all cursor-pointer relative ${
          activeFilter === 'ORANGE'
            ? 'bg-orange-100/90 border-orange-400 border-l-orange-600 ring-2 ring-orange-500/25 shadow-sm'
            : 'bg-orange-50/80 border-orange-200 border-l-orange-500 hover:bg-orange-100/60 hover:border-orange-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-orange-950 uppercase tracking-wider">Orange Alert</p>
          {activeFilter === 'ORANGE' && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-orange-950 bg-white px-1.5 py-0.2 rounded border border-orange-300 shadow-2xs">
              <Check className="w-2.5 h-2.5 text-orange-800" /> Active
            </span>
          )}
        </div>
        <p className="text-xl sm:text-2xl font-bold text-orange-950 font-mono tracking-tight mt-0.5">{orange}</p>
        <p className="text-[11px] text-orange-950 font-medium truncate mt-0.5">
          Half-term (50%) custody review
        </p>
      </button>

      {/* Red Alert */}
      <button
        type="button"
        onClick={() => onSelectFilter(activeFilter === 'RED' ? 'ALL' : 'RED')}
        className={`group text-left py-2 px-3 sm:py-2.5 sm:px-3.5 border border-l-4 rounded-xl transition-all cursor-pointer relative ${
          activeFilter === 'RED'
            ? 'bg-red-100/90 border-red-400 border-l-red-700 ring-2 ring-red-500/25 shadow-sm'
            : 'bg-red-50/80 border-red-200 border-l-red-600 hover:bg-red-100/60 hover:border-red-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-red-950 uppercase tracking-wider">Red Alert</p>
          {activeFilter === 'RED' && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-950 bg-white px-1.5 py-0.2 rounded border border-red-300 shadow-2xs">
              <Check className="w-2.5 h-2.5 text-red-800" /> Active
            </span>
          )}
        </div>
        <p className="text-xl sm:text-2xl font-bold text-red-950 font-mono tracking-tight mt-0.5">{red}</p>
        <p className="text-[11px] text-red-950 font-medium truncate mt-0.5">
          Max-term (100%) custody reached
        </p>
      </button>
    </section>
  );
}

