import { useState } from 'react';
import { Case } from '../types/case';
import { UserProfile } from '../types/auth';
import { 
  FileText, Download, Printer, X, CheckSquare, Square, 
  ShieldCheck, AlertTriangle, Scale, Building2, Calendar, 
  CheckCircle2, ArrowRight, User
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';

export interface JudicialDocModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  docType: 'judicial_review' | 'memo' | 'io_inquiry' | 'dlsa' | 'order_sheet';
  caseItem: Case | null;
  downloadUrl?: string;
  currentUser?: UserProfile | null;
}

export function JudicialDocumentModal({
  isOpen,
  onClose,
  title,
  docType,
  caseItem,
  downloadUrl,
  currentUser
}: JudicialDocModalProps) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [signatureName, setSignatureName] = useState(currentUser?.name || 'Judicial Magistrate - I');

  if (!isOpen || !caseItem) return null;

  const custodyPercent = Math.min(100, Math.round((caseItem.custody_days / (caseItem.maximum_sentence_days || 1)) * 100));

  // Determine Next Step text based on compliance status and case type
  const getNextStep = () => {
    switch (caseItem.compliance.status) {
      case 'RED':
        return 'Mandatory Article 21 & Sec 479(2) Personal Bond Release Order';
      case 'ORANGE':
        return 'Sec 479 BNSS Half-Term Bail Determination & DLSA Notice';
      case 'AMBER':
        return 'Sec 187 BNSS 24-Hour Final Police Report Show Cause Directive';
      case 'NORMAL':
      default:
        return 'Next Periodic Remand Hearing / Trial Stage Review';
    }
  };

  // Section Visited display
  const sectionVisited = caseItem.jail_location 
    ? `${caseItem.jail_location} (Undertrial Ward)` 
    : `${caseItem.court_name} • Remand Section`;

  const visitDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const handleDownload = (isDraft: boolean) => {
    // Generate text/csv or blob simulation for download
    const watermarkText = isDraft ? 'DRAFT_COPY' : 'AUTHENTICATED_FINAL';
    const content = `SUBORDINATE JUDICIARY OF INDIA
${caseItem.court_name}
${title.toUpperCase()} [${watermarkText}]
Date: ${visitDate}
Section Visited: ${sectionVisited}
Case Docket: ${caseItem.docket_no || caseItem.case_id}
CNR: ${caseItem.cnr_number || 'N/A'}
Accused / UTP: ${caseItem.accused_name} (${caseItem.utp_number || 'UTP'})
Police Station: ${caseItem.police_station}
Alleged Offences: ${caseItem.sections || caseItem.offence_section}
Remand Date: ${caseItem.remand_date}
Continuous Detention: ${caseItem.custody_days} Days / ${caseItem.maximum_sentence_days} Days Max (${custodyPercent}%)
Compliance Status: ${caseItem.compliance.status} ALERT (${caseItem.compliance.milestone})
Statutory Reason: ${caseItem.compliance.reason}
Next Statutory Step: ${getNextStep()}
Magistrate Confirmation: ${isConfirmed ? 'CONFIRMED BY PRESIDING MAGISTRATE' : 'PENDING CONFIRMATION'}
Signatory: ${signatureName}
`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl || url;
    link.download = `${isDraft ? 'DRAFT_' : 'FINAL_'}${caseItem.docket_no || caseItem.case_id}_${docType}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-slate-800 text-amber-400 border border-slate-700">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-100 uppercase tracking-wide font-display">
                {title}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Docket: {caseItem.docket_no || caseItem.case_id} • {caseItem.court_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
            title="Close modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main 2-Column Body according to the TL's Template */}
        <div className="p-5 overflow-y-auto flex-1 bg-slate-100/60">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* Left Column: Metadata Boxes, Status/Progress, Confirmation, Download Buttons */}
            <div className="lg:col-span-5 space-y-3.5">
              
              {/* Box 1: Section Visited & Date of Visit */}
              <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-2xs space-y-2.5">
                <div>
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block">
                    Section Visited:
                  </span>
                  <p className="font-bold text-slate-950 text-xs md:text-sm mt-0.5 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-slate-600 shrink-0" />
                    {sectionVisited}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block">
                    Date of Visit / Review:
                  </span>
                  <p className="font-mono font-bold text-slate-900 text-xs mt-0.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    {visitDate}
                  </p>
                </div>
              </div>

              {/* Box 2: Current Progress / Status & Next Step */}
              <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-2xs space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                      Current Progress / Status:
                    </span>
                    <div className="w-24">
                      <StatusBadge status={caseItem.compliance.status} />
                    </div>
                  </div>

                  {/* Progress Bar & Metric */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-xs font-mono font-bold text-slate-800">
                      <span>{caseItem.custody_days} Days Served</span>
                      <span>Max {caseItem.maximum_sentence_days}d ({custodyPercent}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div 
                        className={`h-full transition-all ${caseItem.compliance.status === 'RED' ? 'bg-red-600' : caseItem.compliance.status === 'ORANGE' ? 'bg-orange-500' : 'bg-amber-500'}`} 
                        style={{ width: `${custodyPercent}%` }} 
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-100">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block">
                    Next Step:
                  </span>
                  <p className="font-bold text-slate-900 text-xs mt-0.5 flex items-start gap-1.5 leading-snug">
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-700 shrink-0 mt-0.5" />
                    <span>{getNextStep()}</span>
                  </p>
                </div>
              </div>

              {/* Box 3: Confirmed by Magistrate & Signature Field */}
              <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-2xs space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isConfirmed}
                    onChange={(e) => setIsConfirmed(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-indigo-900 focus:ring-indigo-800 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-950 block">Confirmed by Magistrate</span>
                    <span className="text-slate-500 text-[11px]">Verify compliance record and affix digital judicial seal</span>
                  </div>
                </label>

                {/* Name / Signature Field */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    [Name / Signature Field]
                  </span>
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={signatureName}
                      onChange={(e) => setSignatureName(e.target.value)}
                      placeholder="Magistrate Name"
                      className="flex-1 px-2.5 py-1 text-xs font-bold border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50"
                    />
                  </div>
                  {isConfirmed && (
                    <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 text-[11px] font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Electronically Verified & Signed • {visitDate}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Box 4: Download Draft & Download Final Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => handleDownload(true)}
                  className="px-3.5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Download Draft</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownload(false)}
                  disabled={!isConfirmed}
                  className={`px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors ${
                    isConfirmed 
                      ? 'bg-slate-900 hover:bg-slate-800 text-white' 
                      : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-75'
                  }`}
                  title={isConfirmed ? 'Download Authenticated Final' : 'Check "Confirmed by Magistrate" to download final copy'}
                >
                  <ShieldCheck className={`w-3.5 h-3.5 ${isConfirmed ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span>Download Final</span>
                </button>
              </div>

            </div>

            {/* Right Column: PDF PREVIEW AREA */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-300 shadow-sm p-6 space-y-4 font-serif text-slate-900 text-xs leading-relaxed relative min-h-[460px]">
              
              {/* PDF Preview Top Watermark Badge & Print Button */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 font-sans">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded bg-rose-100 text-rose-800 font-bold text-[10px] uppercase font-mono">
                    PDF Preview
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {isConfirmed ? 'Status: Sealed & Authenticated' : 'Status: Draft Watermarked'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer border border-slate-300 shadow-2xs"
                >
                  <Printer className="w-3 h-3 text-slate-600" />
                  <span>Print Document</span>
                </button>
              </div>

              {/* Watermark in background if draft */}
              {!isConfirmed && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 select-none font-sans font-black text-6xl text-slate-900 rotate-[-25deg]">
                  DRAFT ONLY
                </div>
              )}

              {/* Document Header */}
              <div className="text-center border-b pb-3 border-slate-300">
                <p className="text-[11px] font-bold tracking-widest text-slate-500 uppercase font-sans">Subordinate Judiciary of India</p>
                <h4 className="text-base font-bold text-slate-950 uppercase">{caseItem.court_name}</h4>
                <p className="text-[10px] text-slate-500 font-mono font-sans mt-0.5">UNDER THE BHARATIYA NAGARIK SURAKSHA SANHITA, 2023 (BNSS)</p>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs font-sans bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div><strong>Docket No:</strong> <span className="font-mono">{caseItem.docket_no || caseItem.case_id}</span></div>
                <div><strong>CNR Number:</strong> <span className="font-mono">{caseItem.cnr_number || 'TNTL060000002023'}</span></div>
                <div><strong>Accused / UTP:</strong> <span>{caseItem.accused_name}</span></div>
                <div><strong>Police Station:</strong> <span>{caseItem.police_station}</span></div>
                <div><strong>Offence Sections:</strong> <span>{caseItem.sections || caseItem.offence_section}</span></div>
                <div><strong>Remand Date:</strong> <span className="font-mono">{caseItem.remand_date}</span></div>
                <div><strong>Continuous Custody:</strong> <strong className="text-red-700">{caseItem.custody_days} Days</strong> (of max {caseItem.maximum_sentence_days}d)</div>
                <div><strong>Representation:</strong> <span>{caseItem.representation_status}</span></div>
              </div>

              {/* Specific Directive Based on docType */}
              {docType === 'judicial_review' && (
                <div className="p-3 bg-red-50 border-l-4 border-red-600 rounded text-red-950 font-sans text-xs">
                  <p className="font-bold mb-1">MANDATORY STATUTORY CUSTODY SATURATION ORDER:</p>
                  <p>
                    The accused <strong>{caseItem.accused_name}</strong> has undergone <strong>{caseItem.custody_days} days</strong> in undertrial detention, surpassing statutory thresholds under Section 479(2) BNSS 2023 / Section 436A CrPC.
                    Court orders immediate verification of custody record and scheduling for personal bond release determination.
                  </p>
                </div>
              )}

              {docType === 'io_inquiry' && (
                <div className="p-3 bg-amber-50 border-l-4 border-amber-600 rounded text-amber-950 font-sans text-xs">
                  <p className="font-bold mb-1">STATUTORY REMAND DEADLINE NOTICE (SECTION 187 BNSS):</p>
                  <p>
                    To Station House Officer / Investigating Officer ({caseItem.assigned_io?.name || caseItem.police_station}):
                    Investigation status and final police report under Section 193 BNSS required to be presented within 24 hours. Default bail window active.
                  </p>
                </div>
              )}

              {docType === 'dlsa' && (
                <div className="p-3 bg-emerald-50 border-l-4 border-emerald-600 rounded text-emerald-950 font-sans text-xs">
                  <p className="font-bold mb-1">LEGAL AID COUNSEL ASSIGNMENT & BAIL PETITION DIRECTIVE:</p>
                  <p>
                    Referred to DLSA Secretary for immediate representation of undertrial <strong>{caseItem.accused_name}</strong> under Section 479(1) Proviso BNSS for expedited personal bond application.
                  </p>
                </div>
              )}

              {(docType === 'memo' || docType === 'order_sheet') && (
                <div className="p-3 bg-indigo-50 border-l-4 border-indigo-600 rounded text-indigo-950 font-sans text-xs">
                  <p className="font-bold mb-1">SECTION 479 BNSS HALF-TERM STATUTORY REVIEW ORDER SHEET:</p>
                  <p>
                    Official cause list order memo compiled for registry records and judicial review on custody compliance. Recommended for immediate personal bond scrutiny.
                  </p>
                </div>
              )}

              {/* Signature & Seal Footer */}
              <div className="pt-6 flex justify-between items-end text-xs font-sans text-slate-600 border-t border-slate-200">
                <div className="text-center">
                  <div className={`w-18 h-18 border-2 ${isConfirmed ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold' : 'border-dashed border-slate-300 text-slate-400'} rounded-full flex flex-col items-center justify-center text-[9px] uppercase font-mono`}>
                    <span>{isConfirmed ? '✓ SEALED' : 'COURT SEAL'}</span>
                    <span className="text-[8px]">{visitDate}</span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="w-48 border-t border-slate-900 pt-1 font-bold text-slate-900">
                    {signatureName}
                  </div>
                  <span className="text-[10px] text-slate-500">{caseItem.court_name}</span>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* Modal Bottom Close Bar */}
        <div className="p-3 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0 font-sans">
          <span className="text-slate-500 font-mono text-[11px]">
            Digitally authenticated via RemindTrack PDF & Compliance Engine
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-300 rounded-md font-semibold text-slate-700 bg-white hover:bg-slate-100 cursor-pointer shadow-2xs"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}
