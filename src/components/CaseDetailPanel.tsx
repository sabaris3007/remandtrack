import { useState, useEffect } from 'react';
import { Case } from '../types/case';
import { UserProfile, UserRole } from '../types/auth';
import { StatusBadge } from './StatusBadge';
import { requestJudicialDocument, JudicialDocumentType } from '../services/api';
import { 
  FileText, Download, Printer, X, 
  ShieldCheck, AlertTriangle, Scale, Building2, Calendar, 
  CheckCircle2, ArrowRight, User, ExternalLink, RefreshCw, Loader2,
  Radio, UserCheck, Shield, Send, Check
} from 'lucide-react';

interface CaseDetailPanelProps {
  selectedCase: Case | null;
  onClose: () => void;
  onActionClick: (actionType: string, c: Case) => void;
  currentUser?: UserProfile | null;
}

export function CaseDetailPanel({ selectedCase, onClose, onActionClick, currentUser }: CaseDetailPanelProps) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const userRole = currentUser?.role || 'JUDGE';

  const getDefaultSignerName = () => {
    if (currentUser?.name) return currentUser.name;
    if (userRole === 'INVESTIGATING_OFFICER') return selectedCase?.assigned_io?.name || 'Insp. M. Shanmugam';
    if (userRole === 'DLSA_OFFICER') return selectedCase?.assigned_dlsa_counsel?.name || 'Adv. S. Ramasubramanian';
    if (userRole === 'REGISTRY_CLERK') return selectedCase?.assigned_court_clerk || 'Thiru. K. Arumugam (Head Clerk)';
    return selectedCase?.court_name || 'Court of Judicial Magistrate - I';
  };

  const [signatureName, setSignatureName] = useState(getDefaultSignerName());
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Reset confirmation state & update signature name whenever selectedCase changes or modal reopens
  useEffect(() => {
    setIsConfirmed(false);
    setSignatureName(getDefaultSignerName());
  }, [selectedCase?.case_id, selectedCase?.docket_no, currentUser]);

  // Close modal on Escape
  useEffect(() => {
    if (!selectedCase) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCase, onClose]);

  // Determine docType based on user role & compliance status
  const getDocType = (): JudicialDocumentType => {
    if (!selectedCase) return 'memo';
    if (userRole === 'INVESTIGATING_OFFICER') return 'io_inquiry';
    if (userRole === 'DLSA_OFFICER') return 'dlsa_packet';
    if (userRole === 'REGISTRY_CLERK') return 'memo';
    
    // For Judges:
    if (selectedCase.compliance.status === 'RED') return 'judicial_review';
    if (selectedCase.compliance.status === 'AMBER') return 'io_inquiry';
    return 'judicial_review';
  };

  // Automatically generate role-specific ReportLab PDF when modal opens
  useEffect(() => {
    if (!selectedCase) return;
    let isMounted = true;
    setIsGeneratingPdf(true);
    const docType = getDocType();

    requestJudicialDocument(docType, selectedCase)
      .then((res) => {
        if (isMounted && res.downloadUrl) {
          setPdfUrl(res.downloadUrl);
        }
      })
      .catch((err) => {
        console.error('Error generating PDF preview:', err);
      })
      .finally(() => {
        if (isMounted) setIsGeneratingPdf(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCase, userRole]);

  if (!selectedCase) {
    return null;
  }

  const custodyPercent = Math.min(100, Math.round((selectedCase.custody_days / (selectedCase.maximum_sentence_days || 1)) * 100));

  const visitDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  // Role-Specific Section 1: Heading & Value
  const getSectionHeading = () => {
    switch (userRole) {
      case 'INVESTIGATING_OFFICER':
        return 'Police Station / Case Diary Jurisdiction:';
      case 'DLSA_OFFICER':
        return 'Legal Aid Defense Clinic / Assignment:';
      case 'PRISON_AUTHORITY':
        return 'Prison Facility / Undertrial Custody Ward:';
      case 'REGISTRY_CLERK':
        return 'Court Registry / Process Serving Branch:';
      case 'JUDGE':
      default:
        return 'Section Visited / Inspection:';
    }
  };

  const getSectionVisitedText = () => {
    switch (userRole) {
      case 'INVESTIGATING_OFFICER':
        return `${selectedCase.police_station || 'Station House'} • General Crime Diary`;
      case 'DLSA_OFFICER':
        return `${selectedCase.dlsa_unit || 'District Legal Services Authority, Tirunelveli'} • Undertrial Legal Aid Clinic`;
      case 'PRISON_AUTHORITY':
        return `${selectedCase.jail_location || 'Central Prison, Palayamkottai'} • Undertrial Custody Records Wing`;
      case 'REGISTRY_CLERK':
        return `${selectedCase.court_name} • Registry & Process Serving Department`;
      case 'JUDGE':
      default:
        return selectedCase.jail_location 
          ? `${selectedCase.jail_location} (Undertrial Ward)` 
          : `${selectedCase.court_name} • Remand Section`;
    }
  };

  // Role-Specific Section 2: Next Step Text
  const getNextStep = () => {
    switch (userRole) {
      case 'INVESTIGATING_OFFICER':
        return 'Submit Case Diary (CD) Extract & Sec 187(3) BNSS Final Police Report';
      case 'DLSA_OFFICER':
        return 'Draft Section 479 Personal Bond Bail Application & Legal Aid Assignment';
      case 'PRISON_AUTHORITY':
        return 'Generate UTRC Custody Verification Record & ePrisons Synchronization';
      case 'REGISTRY_CLERK':
        return 'Dispatch Statutory e-Summons & Notice to Jail Superintendent & Police Station';
      case 'JUDGE':
      default:
        switch (selectedCase.compliance.status) {
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
    }
  };

  // Role-Specific Section 3: Configuration for Checkbox, Signature, Buttons, and PDF badge
  const getRoleConfig = () => {
    switch (userRole) {
      case 'INVESTIGATING_OFFICER':
        return {
          title: 'Certified by Investigating Officer',
          subtitle: 'Verify Case Diary entries, investigation stage, and statutory timeline compliance',
          fieldLabel: '[INVESTIGATING OFFICER / BADGE ID]',
          signBadge: `Police Verification Certified • ${visitDate}`,
          btn1Text: 'Submit Case Diary Extract',
          btn2Text: 'Download IO Notice PDF',
          docBadge: 'Police Investigation Delay Notice (Sec 187)',
          actionType: 'IO_SUBMISSION',
        };
      case 'DLSA_OFFICER':
        return {
          title: 'Validated by DLSA Defense Counsel',
          subtitle: 'Verify undertrial representation, financial indigency, and Section 479 eligibility',
          fieldLabel: '[ASSIGNED DLSA COUNSEL / BAR REG]',
          signBadge: `Legal Aid Assignment Certified • ${visitDate}`,
          btn1Text: 'Draft Sec 479 Bail App',
          btn2Text: 'Download DLSA Packet PDF',
          docBadge: 'DLSA Legal Aid Assignment & Bail Packet',
          actionType: 'DLSA_ASSIGNMENT',
        };
      case 'PRISON_AUTHORITY':
        return {
          title: 'Certified by Jail Superintendent',
          subtitle: 'Verify physical custody, daily undertrial roll call, and UTRC records',
          fieldLabel: '[JAIL SUPERINTENDENT / CUSTODY OFFICER]',
          signBadge: `Prison Custody Record Certified • ${visitDate}`,
          btn1Text: 'Certify Custody Roll',
          btn2Text: 'Download UTRC Certificate PDF',
          docBadge: 'UTRC Quarterly Custody Certificate',
          actionType: 'PRISON_CUSTODY_CERT',
        };
      case 'REGISTRY_CLERK':
        return {
          title: 'Dispatched & Logged by Registry',
          subtitle: 'Certify statutory notice service and update CIS 3.0 electronic record',
          fieldLabel: '[COURT MASTER / HEAD CLERK]',
          signBadge: `Electronic Process Logged • ${visitDate}`,
          btn1Text: 'Dispatch e-Summons Notice',
          btn2Text: 'Download Process Sheet PDF',
          docBadge: 'Statutory Court Notice & Process Extract',
          actionType: 'REGISTRY_NOTICE',
        };
      case 'JUDGE':
      default:
        return {
          title: 'Confirmed by Presiding Magistrate',
          subtitle: 'Verify compliance record and authenticate official judicial order',
          fieldLabel: '[PRESIDING JUDICIAL MAGISTRATE]',
          signBadge: `Electronically Verified & Signed • ${visitDate}`,
          btn1Text: 'Download Draft Order',
          btn2Text: 'Download Final Order',
          docBadge: 'Sealed Judicial Order',
          actionType: 'JUDICIAL_REVIEW',
        };
    }
  };

  const roleConfig = getRoleConfig();

  const handleDownload = (isDraft: boolean) => {
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `${isDraft ? 'DRAFT_' : 'AUTHENTICATED_'}${selectedCase.docket_no || selectedCase.case_id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Fallback if direct downloadUrl isn't ready
    const watermarkText = isDraft ? 'DRAFT_COPY' : 'AUTHENTICATED_FINAL';
    const content = `SUBORDINATE JUDICIARY OF INDIA
${selectedCase.court_name}
OFFICIAL COMPLIANCE RECORD [${watermarkText}]
Date: ${visitDate}
Jurisdiction / Section: ${getSectionVisitedText()}
Role: ${userRole}
Case Docket: ${selectedCase.docket_no || selectedCase.case_id}
CNR: ${selectedCase.cnr_number || 'N/A'}
Accused: ${selectedCase.accused_name} (${selectedCase.utp_number || 'UTP'})
Continuous Custody: ${selectedCase.custody_days} Days / ${selectedCase.maximum_sentence_days} Days Max
Statutory Flag: ${selectedCase.compliance.reason}
Next Step: ${getNextStep()}
Signatory / Officer: ${signatureName}
Certification Status: ${isConfirmed ? 'AUTHENTICATED' : 'PENDING'}
`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${isDraft ? 'DRAFT_' : 'FINAL_'}${selectedCase.docket_no || selectedCase.case_id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrimaryActionClick = () => {
    if (userRole === 'JUDGE') {
      handleDownload(true);
    } else {
      onActionClick(roleConfig.actionType, selectedCase);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header Bar */}
        <div className="px-5 py-3 bg-slate-900 text-white border-b border-slate-800 shrink-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 bg-white px-2.5 py-0.5 rounded-md border border-slate-300 shadow-2xs">
              {selectedCase.docket_no || selectedCase.case_id}
            </span>
            {selectedCase.judge_hierarchy && (
              <span className="text-xs font-mono font-bold text-amber-300 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700 uppercase">
                Hierarchy: {selectedCase.judge_hierarchy}
              </span>
            )}
            {selectedCase.cnr_number && (
              <span className="text-xs font-mono font-bold text-indigo-200 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                CNR: {selectedCase.cnr_number}
              </span>
            )}
            {selectedCase.police_station && (
              <span className="text-xs font-semibold text-slate-300 font-mono hidden sm:inline">
                • {selectedCase.police_station}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              title="Close Case Details (Esc)"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body: TL Template 2-Column Layout */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 bg-slate-100/70">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            
            {/* Left Column: Metadata Boxes, Status/Progress, Confirmation, Action Buttons */}
            <div className="lg:col-span-5 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                
                {/* Box 1: Section Visited / Jurisdiction & Date */}
                <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-2xs space-y-2">
                  <div>
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block">
                      {getSectionHeading()}
                    </span>
                    <p className="font-bold text-slate-950 text-xs md:text-sm mt-0.5 flex items-center gap-1.5 leading-snug">
                      <Building2 className="w-4 h-4 text-slate-600 shrink-0" />
                      {getSectionVisitedText()}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block">
                      Date of Review / Certification:
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
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                        Current Progress / Status:
                      </span>
                      <div className="shrink-0">
                        <StatusBadge status={selectedCase.compliance.status} />
                      </div>
                    </div>

                    {/* Progress Bar & Metric */}
                    <div className="space-y-1.5 pt-0.5">
                      <div className="flex justify-between text-xs font-mono font-bold text-slate-800">
                        <span>{selectedCase.custody_days} Days Served</span>
                        <span>Max {selectedCase.maximum_sentence_days}d ({custodyPercent}%)</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div 
                          className={`h-full transition-all ${selectedCase.compliance.status === 'RED' ? 'bg-red-600' : selectedCase.compliance.status === 'ORANGE' ? 'bg-orange-500' : 'bg-amber-500'}`} 
                          style={{ width: `${custodyPercent}%` }} 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 block">
                      Next Step:
                    </span>
                    <p className="font-bold text-slate-900 text-xs mt-0.5 flex items-start gap-1.5 leading-snug">
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-700 shrink-0 mt-0.5" />
                      <span>{getNextStep()}</span>
                    </p>
                  </div>
                </div>

                {/* Box 3: Role-Specific Confirmation & Signature Field */}
                <div className="bg-white p-4 rounded-xl border border-slate-300 shadow-2xs space-y-2.5">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isConfirmed}
                      onChange={(e) => setIsConfirmed(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-slate-300 text-indigo-900 focus:ring-indigo-800 cursor-pointer"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-slate-950 block">{roleConfig.title}</span>
                      <span className="text-slate-500 text-[11px]">{roleConfig.subtitle}</span>
                    </div>
                  </label>

                  {/* Name / Signature Field */}
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      {roleConfig.fieldLabel}
                    </span>
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="text"
                        value={signatureName}
                        onChange={(e) => setSignatureName(e.target.value)}
                        placeholder="Authorized Officer Name"
                        className="flex-1 px-2.5 py-1 text-xs font-bold border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50 text-slate-900"
                      />
                    </div>
                    {isConfirmed && (
                      <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 text-[11px] font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{roleConfig.signBadge}</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Box 4: Role-Specific Action & Download Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handlePrimaryActionClick}
                  className="px-3.5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span className="truncate">{roleConfig.btn1Text}</span>
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
                  title={isConfirmed ? roleConfig.btn2Text : `Check "${roleConfig.title}" to enable final authenticated download`}
                >
                  <ShieldCheck className={`w-3.5 h-3.5 ${isConfirmed ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span className="truncate">{roleConfig.btn2Text}</span>
                </button>
              </div>

            </div>

            {/* Right Column: ACTUAL REPORTLAB PDF PREVIEW AREA (Tailored per Role) */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-300 shadow-sm flex flex-col overflow-hidden min-h-[460px]">
              
              {/* PDF Preview Top Action Bar */}
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0 font-sans text-xs">
                <div className="flex items-center gap-2">
                  <span className="p-1 px-1.5 rounded bg-slate-900 text-white font-bold text-[10px] uppercase font-mono flex items-center gap-1">
                    <FileText className="w-3 h-3 text-amber-400" /> PDF PREVIEW
                  </span>
                  <span className="text-[11px] font-semibold text-slate-700 hidden sm:inline">
                    {isGeneratingPdf ? 'Compiling ReportLab PDF...' : roleConfig.docBadge}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {pdfUrl && (
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer border border-slate-300 shadow-2xs"
                      title="Open PDF in new browser tab"
                    >
                      <ExternalLink className="w-3 h-3 text-slate-600" />
                      <span>Open PDF</span>
                    </a>
                  )}

                  <button
                    onClick={() => {
                      if (pdfUrl) {
                        const w = window.open(pdfUrl, '_blank');
                        w?.print();
                      } else {
                        window.print();
                      }
                    }}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                    title="Print Document"
                  >
                    <Printer className="w-3 h-3 text-amber-400" />
                    <span>Print</span>
                  </button>
                </div>
              </div>

              {/* Embedded PDF Viewer */}
              <div className="flex-1 bg-slate-200/90 relative flex items-center justify-center min-h-[440px] max-h-[70vh]">
                {isGeneratingPdf ? (
                  <div className="flex flex-col items-center gap-2 text-slate-600 p-8">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-800" />
                    <span className="text-xs font-mono font-bold">Compiling Official ReportLab Vector PDF...</span>
                  </div>
                ) : pdfUrl ? (
                  <iframe 
                    src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                    className="w-full h-full border-0 min-h-[440px] max-h-[70vh]"
                    title="Official PDF Preview"
                  />
                ) : (
                  <div className="text-center p-8 text-slate-500 text-xs">
                    <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                    <p className="font-bold text-slate-700">PDF Generator Initializing...</p>
                    <p className="text-[11px] text-slate-500 mt-1">Connecting to Subordinate Judiciary Document Engine (ReportLab)</p>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>

        {/* Modal Bottom Footer */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 text-xs flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 font-mono">
            RemindTrack Module 4 Document Engine • ReportLab 3.x Vector Generation
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md font-bold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
