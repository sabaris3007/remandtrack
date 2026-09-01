import { Case } from '../types/case';
import { Calendar, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

export function MilestoneTimeline({ data }: { data: Case }) {
  const isAmber = data.compliance.status === 'AMBER';
  const isOrange = data.compliance.status === 'ORANGE';
  const isRed = data.compliance.status === 'RED';

  const step2Active = isAmber || data.custody_days >= 90 || data.chargesheet_status.includes('Filed');
  const step3Active = isOrange || data.custody_days >= (data.maximum_sentence_days ? data.maximum_sentence_days / 2 : 548);
  const step4Active = isRed || data.custody_days >= (data.maximum_sentence_days || 1095);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
      {/* 1. Remand Date */}
      <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs space-y-1 relative">
        <div className="flex items-center justify-between">
          <span className="font-bold text-[11px] text-slate-900 uppercase tracking-wide">1. Remand</span>
          <span className="font-mono text-[10.5px] text-slate-600 font-bold">{data.remand_date}</span>
        </div>
        <p className="text-[11px] text-slate-600 truncate font-medium">1st custody order issued</p>
      </div>

      {/* 2. Day 90 Investigation Window */}
      <div className={`p-2.5 rounded-lg border text-xs space-y-1 relative ${
        isAmber 
          ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-400' 
          : step2Active 
          ? 'bg-white border-slate-200' 
          : 'bg-slate-50/60 border-slate-200 opacity-75'
      }`}>
        <div className="flex items-center justify-between">
          <span className={`font-bold text-[11px] uppercase tracking-wide ${isAmber ? 'text-amber-950 font-black' : 'text-slate-900'}`}>
            2. Day 90 Window
          </span>
          <span className="font-mono text-[10px] text-slate-600 font-bold">§187 BNSS</span>
        </div>
        <p className={`text-[11px] truncate font-medium ${isAmber ? 'text-amber-950 font-bold' : 'text-slate-600'}`}>
          {data.chargesheet_status.includes('Filed') 
            ? `Report filed (${data.chargesheet_date || 'Filed'})` 
            : isAmber 
            ? 'Default bail window triggers' 
            : `${data.custody_days}/90d elapsed`}
        </p>
      </div>

      {/* 3. Year 1.5 / Half-Term Milestone */}
      <div className={`p-2.5 rounded-lg border text-xs space-y-1 relative ${
        isOrange 
          ? 'bg-orange-50 border-orange-300 ring-1 ring-orange-400' 
          : step3Active 
          ? 'bg-white border-slate-200' 
          : 'bg-slate-50/60 border-slate-200 opacity-75'
      }`}>
        <div className="flex items-center justify-between">
          <span className={`font-bold text-[11px] uppercase tracking-wide ${isOrange ? 'text-orange-950 font-black' : 'text-slate-900'}`}>
            3. Half-Term (50%)
          </span>
          <span className="font-mono text-[10px] text-slate-600 font-bold">§479 BNSS</span>
        </div>
        <p className={`text-[11px] truncate font-medium ${isOrange ? 'text-orange-950 font-bold' : 'text-slate-600'}`}>
          {data.custody_days >= 548 
            ? '548+ days served (Eligible)' 
            : `Triggers at ${Math.round((data.maximum_sentence_days || 1095) / 2)}d custody`}
        </p>
      </div>

      {/* 4. Year 3 / Max-Term Milestone */}
      <div className={`p-2.5 rounded-lg border text-xs space-y-1 relative ${
        isRed 
          ? 'bg-red-50 border-red-300 ring-1 ring-red-400' 
          : step4Active 
          ? 'bg-white border-slate-200' 
          : 'bg-slate-50/60 border-slate-200 opacity-75'
      }`}>
        <div className="flex items-center justify-between">
          <span className={`font-bold text-[11px] uppercase tracking-wide ${isRed ? 'text-red-950 font-black' : 'text-slate-900'}`}>
            4. Max Ceiling
          </span>
          <span className="font-mono text-[10px] text-slate-600 font-bold">{data.maximum_sentence_days || 1095}d</span>
        </div>
        <p className={`text-[11px] truncate font-medium ${isRed ? 'text-red-950 font-bold' : 'text-slate-600'}`}>
          {isRed 
            ? 'Exceeds statutory ceiling' 
            : 'Max custody limit'}
        </p>
      </div>
    </div>
  );
}


