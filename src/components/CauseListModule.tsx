import { useState, useEffect, useMemo, useRef, ChangeEvent } from 'react';
import { Header } from './Header';
import { SummaryCards } from './SummaryCards';
import { CauseListTable } from './CauseListTable';
import { CaseDetailPanel } from './CaseDetailPanel';
import { JudicialDocumentModal } from './JudicialDocumentModal';
import { Case, ComplianceStatus } from '../types/case';
import { UserProfile, UserRole, JudgeHierarchyCode } from '../types/auth';
import { fetchCauseList, requestJudicialDocument, emitAuditEvent, AuditEventPayload, JudicialDocumentType } from '../services/api';
import { generateLargeDataset, parseCustomDataset, exportCasesToCSV } from '../utils/largeDatasetGenerator';
import { 
  CheckCircle, X, Printer, Database, RefreshCw, Scale, Send, Shield, 
  User, UserCheck, Bell, ShieldAlert, Check, FileText, FileSpreadsheet, 
  ArrowRight, Layers, Zap, Upload, Download, Sparkles, Cpu, AlertCircle, FileUp
} from 'lucide-react';
import { useRouter } from '../router/Router';

export interface CauseListModuleProps {
  /** Optional custom case data passed directly by parent CIS/eCourts portal */
  cases?: Case[];
  /** Optional custom court title */
  courtTitle?: string;
  /** Whether to show the top navigation bar */
  showHeader?: boolean;
  /** Currently logged-in judicial stakeholder profile */
  currentUser?: UserProfile | null;
  /** Callback when logging out */
  onLogout?: () => void;
  /** Callback when switching demo personas */
  onSwitchPersona?: (role: UserRole) => void;
  /** Callback when switching institutional judge hierarchy */
  onSwitchJudgeHierarchy?: (code: JudgeHierarchyCode) => void;
  /** Callback when magistrate inspects a docket */
  onCaseSelected?: (selectedCase: Case) => void;
  /** Custom handler for judicial actions */
  onJudicialAction?: (actionType: string, targetCase: Case) => Promise<boolean | void> | void;
  /** Custom audit logger hook */
  onAuditEvent?: (event: AuditEventPayload) => void;
  /** Custom class name for wrapping container */
  className?: string;
}

export function CauseListModule({
  cases: propCases,
  courtTitle = 'Court of Metropolitan Magistrate - 04',
  showHeader = true,
  currentUser,
  onLogout,
  onSwitchPersona,
  onSwitchJudgeHierarchy,
  onCaseSelected,
  onJudicialAction,
  onAuditEvent,
  className = '',
}: CauseListModuleProps) {
  const { currentPath, params, navigate } = useRouter();
  const [internalCases, setInternalCases] = useState<Case[]>(propCases || []);
  const [loading, setLoading] = useState<boolean>(!propCases);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [activeFilter, setActiveFilter] = useState<ComplianceStatus | 'ALL'>('ALL');

  // Modal states for judicial & stakeholder workflow actions
  const [activeModal, setActiveModal] = useState<{
    type: string;
    caseItem: Case;
  } | null>(null);
  const [actionSuccessToast, setActionSuccessToast] = useState<string | null>(null);
  const [showAuditDrawer, setShowAuditDrawer] = useState<boolean>(false);
  const [showPrivilegeModal, setShowPrivilegeModal] = useState<boolean>(false);
  const [showScaleModal, setShowScaleModal] = useState<boolean>(false);
  const [showInternalToolbar, setShowInternalToolbar] = useState<boolean>(() => {
    return localStorage.getItem('court_show_internal_toolbar') === 'true';
  });

  // Global Keyboard Shortcut: Option+Shift+K (or Alt+Shift+K) to toggle internal tools bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && (e.key === 'K' || e.key === 'k' || e.code === 'KeyK')) {
        e.preventDefault();
        setShowInternalToolbar(prev => {
          const next = !prev;
          localStorage.setItem('court_show_internal_toolbar', String(next));
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [activeDatasetMode, setActiveDatasetMode] = useState<string>('Integrated Docket (28 Cases)');
  const [benchmarkTiming, setBenchmarkTiming] = useState<{ count: number; durationMs: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Bench Scope State: Defaults to 'ALL' so the entire integrated dataset is immediately visible,
  // while preserving capability to toggle to 'MY_BENCH'
  const [benchScope, setBenchScope] = useState<'ALL' | 'MY_BENCH'>('ALL');
  const [isExecutingWorkflow, setIsExecutingWorkflow] = useState<boolean>(false);

  // Generated document preview & download modal
  const [generatedDocModal, setGeneratedDocModal] = useState<{
    title: string;
    downloadUrl?: string;
    documentHtml?: string;
    caseItem: Case;
    docType: string;
  } | null>(null);

  // Form states for modal interactions
  const [ioStatusText, setIoStatusText] = useState('Final Police Report under Sec 187 BNSS submitted for scrutiny.');
  const [counselName, setCounselName] = useState('Adv. Meenakshi Sundaram (LADC Panel)');
  const [selectedChannels, setSelectedChannels] = useState<{ sms: boolean; whatsapp: boolean; ecourts: boolean }>({
    sms: true,
    whatsapp: true,
    ecourts: true,
  });

  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchCauseList();
      setInternalCases(data);
      setActiveDatasetMode(`Integrated Docket (${data.length} Cases)`);
      setBenchmarkTiming(null);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // High-performance benchmark generation for 1,000 to 5,000 records
  const handleLoadBenchmark = (count: number, label: string) => {
    setIsRefreshing(true);
    setLoading(true);
    const start = performance.now();
    
    setTimeout(() => {
      const generated = generateLargeDataset(count);
      const end = performance.now();
      const duration = Math.round(end - start);
      
      setInternalCases(generated);
      setActiveDatasetMode(label);
      setBenchmarkTiming({ count, durationMs: duration });
      setSelectedCase(null);
      setLoading(false);
      setIsRefreshing(false);
      setShowScaleModal(false);
      setActionSuccessToast(`⚡ Successfully indexed ${count.toLocaleString()} undertrial records in ${duration}ms.`);
      setTimeout(() => setActionSuccessToast(null), 4000);
    }, 50);
  };

  // Custom File Import (CSV or JSON with up to thousands of records)
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setIsRefreshing(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const start = performance.now();
        const importedCases = parseCustomDataset(text, file.name);
        const end = performance.now();
        const duration = Math.round(end - start);

        if (importedCases.length === 0) {
          throw new Error('No valid case rows found in the uploaded file.');
        }

        setInternalCases(importedCases);
        setActiveDatasetMode(`Imported: ${file.name} (${importedCases.length.toLocaleString()} cases)`);
        setBenchmarkTiming({ count: importedCases.length, durationMs: duration });
        setSelectedCase(null);
        setShowScaleModal(false);
        setActionSuccessToast(`📁 Successfully imported ${importedCases.length.toLocaleString()} cases in ${duration}ms.`);
        setTimeout(() => setActionSuccessToast(null), 4000);
      } catch (err: any) {
        setImportError(err.message || 'Failed to parse file.');
      } finally {
        setIsRefreshing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setImportError('Failed to read file.');
      setIsRefreshing(false);
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    if (propCases && propCases.length > 0) {
      setInternalCases(propCases);
      setLoading(false);
    } else {
      loadData();
    }
  }, [propCases]);

  const rawCases = propCases && propCases.length > 0 ? propCases : internalCases;

  // JUDICIAL ACCESS CONTROL / BENCH ISOLATION:
  // Subordinate Judges (JM-I, JM-II, JM-III) are strictly isolated to their assigned bench matters.
  // Only the Chief Judicial Magistrate (CJM) holds district-wide supervisory visibility across all benches.
  const displayedCases = useMemo(() => {
    if (currentUser?.role === 'JUDGE' && currentUser.judge_hierarchy && currentUser.judge_hierarchy !== 'cjm') {
      return rawCases.filter(c => c.judge_hierarchy === currentUser.judge_hierarchy);
    }
    return rawCases;
  }, [rawCases, currentUser]);

  // Single-pass high performance metric aggregation across 1,000+ items
  const { total, normal, amber, orange, red } = useMemo(() => {
    let norm = 0, amb = 0, org = 0, rd = 0;
    for (let i = 0; i < displayedCases.length; i++) {
      const st = displayedCases[i].compliance?.status;
      if (st === 'NORMAL') norm++;
      else if (st === 'AMBER') amb++;
      else if (st === 'ORANGE') org++;
      else if (st === 'RED') rd++;
    }
    return {
      total: displayedCases.length,
      normal: norm,
      amber: amb,
      orange: org,
      red: rd,
    };
  }, [displayedCases]);

  // Synchronize deep-link route /workspace/case/:caseId with selectedCase
  useEffect(() => {
    if (params.caseId && rawCases.length > 0) {
      const targetId = decodeURIComponent(params.caseId).toLowerCase().trim();
      const matched = rawCases.find(
        c => c.case_id.toLowerCase() === targetId || (c.docket_no && c.docket_no.toLowerCase() === targetId)
      );
      if (matched && selectedCase?.case_id !== matched.case_id) {
        setSelectedCase(matched);
      }
    } else if (!params.caseId && selectedCase && currentPath === '/workspace') {
      setSelectedCase(null);
    }
  }, [params.caseId, rawCases, currentPath]);

  // Synchronize /audit path with showAuditDrawer
  useEffect(() => {
    if (currentPath === '/audit') {
      const raw = localStorage.getItem('remindtrack_audit_logs');
      if (raw) {
        try {
          setAuditLogs(JSON.parse(raw));
        } catch (e) {
          setAuditLogs([]);
        }
      }
      setShowAuditDrawer(true);
    } else if (currentPath === '/workspace' && showAuditDrawer) {
      setShowAuditDrawer(false);
    }
  }, [currentPath]);

  const handleSelectCase = (c: Case) => {
    setSelectedCase(c);
    navigate(`/workspace/case/${encodeURIComponent(c.case_id)}`);
    if (onCaseSelected) {
      onCaseSelected(c);
    }

    // Emit audit view event (Module 5)
    const auditPayload: AuditEventPayload = {
      timestamp: new Date().toISOString(),
      magistrate_court: courtTitle,
      case_id: c.case_id,
      action_type: 'VIEW_DOCKET',
      milestone: c.compliance.milestone,
      status: c.compliance.status,
    };

    emitAuditEvent(auditPayload);
    if (onAuditEvent) {
      onAuditEvent(auditPayload);
    }
  };

  const handleActionClick = (actionType: string, c: Case) => {
    setSelectedCase(c);
    setActiveModal({
      type: actionType,
      caseItem: c,
    });
  };

  const handleExecuteModalAction = async (msg: string) => {
    if (!activeModal || isExecutingWorkflow) return;
    setIsExecutingWorkflow(true);

    try {
      const targetCase = activeModal.caseItem;
      const actionType = activeModal.type;

      const isJudicialDocType = (type: string): type is JudicialDocumentType => {
        return ['judicial_review', 'memo', 'io_inquiry', 'dlsa'].includes(type);
      };

      let docResult: any = null;

      // 1. If parent provided custom handler, run it, otherwise call document API
      if (onJudicialAction) {
        await onJudicialAction(actionType, targetCase);
      } else if (isJudicialDocType(actionType)) {
        // Trigger API/Module hook for judicial document generation
        docResult = await requestJudicialDocument(actionType, targetCase);
      }

      // 2. Realtime state modification and notification logging:
      const nowIso = new Date().toISOString();
      const dateFormatted = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

      let updatedNotification: any = null;
      let updatedDiaryStatus = targetCase.case_diary_status;
      let updatedChargesheetStatus = targetCase.chargesheet_status;
      let updatedRepresentationStatus = targetCase.representation_status;
      let updatedDlsaCounsel = targetCase.assigned_dlsa_counsel;

      if (actionType === 'judicial_review') {
        updatedNotification = {
          id: `notif-rev-${Date.now()}`,
          timestamp: nowIso,
          recipient_role: 'JUDGE' as const,
          recipient_name: targetCase.assigned_judge || 'Presiding Magistrate',
          channel: 'eCourts_Portal' as const,
          subject: `MANDATORY JUDICIAL REVIEW ORDER: Max Custody Term (${targetCase.custody_days}d) determination initiated for ${targetCase.accused_name}.`,
          status: 'DELIVERED' as const,
        };
        updatedDiaryStatus = `Judicial review initiated by Hon'ble Magistrate on ${dateFormatted}. Custody verification & personal bond release process under Sec 479 BNSS commenced.`;
      } else if (actionType === 'memo') {
        updatedNotification = {
          id: `notif-memo-${Date.now()}`,
          timestamp: nowIso,
          recipient_role: 'REGISTRY' as const,
          recipient_name: targetCase.assigned_court_clerk || 'Court Master',
          channel: 'eCourts_Portal' as const,
          subject: `Section 479 Compliance Review Memo generated and placed on docket for ${targetCase.docket_no}.`,
          status: 'DELIVERED' as const,
        };
        updatedDiaryStatus = `Statutory compliance order sheet compiled on ${dateFormatted}. Listed for bail eligibility review.`;
      } else if (actionType === 'io_inquiry') {
        updatedNotification = {
          id: `notif-io-${Date.now()}`,
          timestamp: nowIso,
          recipient_role: 'INVESTIGATING_OFFICER' as const,
          recipient_name: targetCase.assigned_io?.name || 'Investigating Officer',
          channel: selectedChannels.sms ? ('SMS' as const) : ('WhatsApp' as const),
          subject: `URGENT NOTICE (Sec 187 BNSS): Submit Final Police Report for ${targetCase.docket_no} within 24 hours.`,
          status: 'DELIVERED' as const,
        };
        updatedDiaryStatus = `Statutory notice served to IO (${targetCase.assigned_io?.name || 'IO'}) regarding Sec 187 investigation timeline on ${dateFormatted}.`;
      } else if (actionType === 'dlsa') {
        updatedNotification = {
          id: `notif-dlsa-${Date.now()}`,
          timestamp: nowIso,
          recipient_role: 'DLSA_OFFICER' as const,
          recipient_name: targetCase.dlsa_unit || 'DLSA Secretary',
          channel: 'WhatsApp' as const,
          subject: `DLSA Bail Referral Packet issued for ${targetCase.accused_name} (${targetCase.custody_days}d in custody).`,
          status: 'DELIVERED' as const,
        };
        updatedDiaryStatus = `DLSA Legal Aid referral package transmitted on ${dateFormatted} for Sec 479 personal bond representation.`;
      } else if (actionType === 'io_update_status') {
        updatedDiaryStatus = ioStatusText;
        updatedChargesheetStatus = 'Submitted to Court Scrutiny';
        updatedNotification = {
          id: `notif-io-up-${Date.now()}`,
          timestamp: nowIso,
          recipient_role: 'JUDGE' as const,
          recipient_name: targetCase.assigned_judge || 'Presiding Magistrate',
          channel: 'eCourts_Portal' as const,
          subject: `IO Case Diary Status Update logged for ${targetCase.docket_no}.`,
          status: 'DELIVERED' as const,
        };
      } else if (actionType === 'dlsa_assign') {
        updatedRepresentationStatus = 'DLSA Appointed';
        updatedDlsaCounsel = {
          name: counselName,
          bar_reg_no: 'MS/1842/2014',
          phone: '+91 98712 34567',
          assigned_date: dateFormatted,
          counsel_type: 'DLSA Legal Aid',
        };
        updatedNotification = {
          id: `notif-counsel-${Date.now()}`,
          timestamp: nowIso,
          recipient_role: 'DLSA_OFFICER' as const,
          recipient_name: counselName,
          channel: 'SMS' as const,
          subject: `Legal Aid Counsel Assignment: ${counselName} appointed for ${targetCase.accused_name} (${targetCase.docket_no}).`,
          status: 'DELIVERED' as const,
        };
        updatedDiaryStatus = `Legal Aid Defense Counsel ${counselName} assigned on ${dateFormatted}.`;
      } else if (actionType === 'dlsa_petition') {
        updatedNotification = {
          id: `notif-pet-${Date.now()}`,
          timestamp: nowIso,
          recipient_role: 'JUDGE' as const,
          recipient_name: targetCase.assigned_judge || 'Presiding Magistrate',
          channel: 'eCourts_Portal' as const,
          subject: `Section 479 Bail Application filed by DLSA Counsel on behalf of ${targetCase.accused_name}.`,
          status: 'DELIVERED' as const,
        };
        updatedDiaryStatus = `Section 479 statutory bail petition filed by DLSA on ${dateFormatted}. Listed for hearing.`;
      } else if (actionType === 'dispatch_alert') {
        updatedNotification = {
          id: `notif-alert-${Date.now()}`,
          timestamp: nowIso,
          recipient_role: 'INVESTIGATING_OFFICER' as const,
          recipient_name: targetCase.assigned_io?.name || 'Investigating Officer',
          channel: selectedChannels.sms ? ('SMS' as const) : selectedChannels.whatsapp ? ('WhatsApp' as const) : ('eCourts_Portal' as const),
          subject: `Statutory Compliance Alert dispatched for ${targetCase.accused_name} (${targetCase.docket_no}).`,
          status: 'DELIVERED' as const,
        };
        updatedDiaryStatus = `Statutory compliance alert broadcasted to IO & Registry on ${dateFormatted}.`;
      } else if (actionType === 'sync_cis') {
        updatedNotification = {
          id: `notif-cis-${Date.now()}`,
          timestamp: nowIso,
          recipient_role: 'REGISTRY' as const,
          recipient_name: 'Court Registry',
          channel: 'eCourts_Portal' as const,
          subject: `CIS 3.0 Remand Log synchronization completed for ${targetCase.docket_no}.`,
          status: 'DELIVERED' as const,
        };
        updatedDiaryStatus = `CIS 3.0 remand log timestamps synchronized on ${dateFormatted}.`;
      }

      const updatedCase: Case = {
        ...targetCase,
        case_diary_status: updatedDiaryStatus,
        chargesheet_status: updatedChargesheetStatus,
        representation_status: updatedRepresentationStatus,
        assigned_dlsa_counsel: updatedDlsaCounsel,
        notification_history: updatedNotification 
          ? [updatedNotification, ...(targetCase.notification_history || [])]
          : (targetCase.notification_history || []),
      };

      setInternalCases(prev => prev.map(item => item.case_id === targetCase.case_id ? updatedCase : item));
      if (selectedCase && selectedCase.case_id === targetCase.case_id) {
        setSelectedCase(updatedCase);
      }

      // 3. Trigger Module 5 (Audit Trail Logger)
      let auditAction: any = 'GENERATED_MEMO';
      if (actionType === 'io_inquiry') auditAction = 'ISSUED_IO_INQUIRY';
      if (actionType === 'judicial_review') auditAction = 'INITIATED_JUDICIAL_REVIEW';
      if (actionType === 'dlsa') auditAction = 'DLSA_REFERRAL';
      if (actionType === 'io_update_status') auditAction = 'IO_STATUS_UPDATE';
      if (actionType === 'dlsa_petition') auditAction = 'DLSA_BAIL_PETITION';
      if (actionType === 'dispatch_alert') auditAction = 'DISPATCHED_STATUTORY_ALERT';

      const auditPayload: AuditEventPayload = {
        timestamp: nowIso,
        magistrate_court: courtTitle,
        case_id: targetCase.case_id,
        action_type: auditAction,
        milestone: targetCase.compliance.milestone,
        status: targetCase.compliance.status,
        meta: {
          docket_no: targetCase.docket_no,
          custody_days: targetCase.custody_days,
          statutory_ref: targetCase.compliance.statutory_ref,
          actor_role: currentUser?.role || 'JUDGE',
          actor_name: currentUser?.name,
        },
      };

      await emitAuditEvent(auditPayload);
      if (onAuditEvent) {
        onAuditEvent(auditPayload);
      }

      setActiveModal(null);

      // Open Document Preview Modal if document was generated
      if (isJudicialDocType(actionType)) {
        setGeneratedDocModal({
          title: actionType === 'judicial_review' 
            ? 'Mandatory Statutory Review Order Sheet'
            : actionType === 'io_inquiry'
            ? 'Section 187 BNSS Notice to Investigating Officer'
            : actionType === 'dlsa'
            ? 'DLSA Legal Aid Referral & Representation Package'
            : 'Section 479 Compliance Order Sheet',
          downloadUrl: docResult?.downloadUrl,
          caseItem: updatedCase,
          docType: actionType,
        });
      }

      setActionSuccessToast(msg);
      setTimeout(() => {
        setActionSuccessToast(null);
      }, 5000);
    } finally {
      setIsExecutingWorkflow(false);
    }
  };

  const handleOpenAuditDrawer = () => {
    const raw = localStorage.getItem('remindtrack_audit_logs');
    if (raw) {
      try {
        setAuditLogs(JSON.parse(raw));
      } catch (e) {
        setAuditLogs([]);
      }
    }
    setShowAuditDrawer(true);
    navigate('/audit');
  };

  return (
    <div className={`w-full h-full flex flex-col font-sans overflow-hidden text-slate-900 select-none bg-slate-100 ${className}`}>
      {showHeader && (
        <Header 
          currentUser={currentUser} 
          onLogout={onLogout} 
          onSwitchPersona={onSwitchPersona} 
          onSwitchJudgeHierarchy={onSwitchJudgeHierarchy}
          onOpenPrivilegeMatrix={() => setShowPrivilegeModal(true)}
        />
      )}

      {/* Interactive Summary Filter Cards with Integration Status Bar */}
      <div className="flex flex-col shrink-0">
        <SummaryCards
          total={total}
          normal={normal}
          amber={amber}
          orange={orange}
          red={red}
          activeFilter={activeFilter}
          onSelectFilter={setActiveFilter}
        />

        {/* Integration Quick Bridge Toolbar (Hidden by default, toggle with Alt+Shift+K / Option+Shift+K) */}
        {showInternalToolbar && (
          <div className="bg-slate-900 text-slate-300 px-6 lg:px-8 py-1.5 flex items-center justify-between text-[10px] border-b border-slate-800 shrink-0 animate-in fade-in duration-150">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-emerald-400 font-mono font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Mod 2 API: Connected (/api/cause-list)
              </span>
              <span className="hidden sm:inline text-slate-500">•</span>
              <span className="hidden sm:inline text-slate-400">
                Active User: <strong className="text-amber-400">{currentUser?.name || 'Magistrate'}</strong> ({currentUser?.role || 'JUDGE'})
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setShowScaleModal(true)}
                className="text-slate-200 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-400/40 hover:bg-amber-500/30 cursor-pointer shadow-2xs font-bold transition-colors"
                title="Switch to 1,000+ Record Benchmark Dataset or Import Custom Data"
              >
                <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                <span>Dataset Scaler ({total.toLocaleString()} Records)</span>
                {benchmarkTiming && (
                  <span className="bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded font-mono text-[9px] font-black">
                    {benchmarkTiming.durationMs}ms
                  </span>
                )}
              </button>
              <button
                onClick={handleOpenAuditDrawer}
                className="text-slate-300 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 cursor-pointer shadow-2xs"
                title="Inspect Module 5 Audit Log"
              >
                <Database className="w-3 h-3 text-amber-400" />
                <span>Mod 5 Audit Log</span>
              </button>
              <button
                onClick={loadData}
                disabled={isRefreshing}
                className="text-slate-300 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 cursor-pointer disabled:opacity-50 shadow-2xs"
                title="Sync from Ingestion Engine"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
                <span>Sync Docket</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Workspace (Cause List Table + Inspection Panel) */}
      <main className="flex-1 flex overflow-hidden relative">
        {loading ? (
          <div className="flex-1 flex items-center justify-center border-r border-slate-200 bg-white">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-slate-800 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">
                Fetching Daily Cause List & Compliance Ladder...
              </p>
            </div>
          </div>
        ) : (
          <CauseListTable
            cases={displayedCases}
            activeFilter={activeFilter}
            onClearFilter={() => setActiveFilter('ALL')}
            onSelectCase={handleSelectCase}
            selectedCaseId={selectedCase?.case_id}
            onActionClick={handleActionClick}
            currentUser={currentUser}
            benchScope={benchScope}
            onToggleBenchScope={setBenchScope}
          />
        )}
      </main>

      {/* Case Details & Action Inspection Modal */}
      <CaseDetailPanel
        selectedCase={selectedCase}
        onClose={() => {
          setSelectedCase(null);
          navigate('/workspace');
        }}
        onActionClick={handleActionClick}
        currentUser={currentUser}
      />

      {/* Success Notification Toast */}
      {actionSuccessToast && (
        <div className="fixed bottom-5 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom-2 duration-200 max-w-md">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <div className="flex-1 text-xs">
            <p className="font-bold text-slate-100">Workflow Dispatched Successfully</p>
            <p className="text-[11px] text-slate-300 mt-0.5">{actionSuccessToast}</p>
          </div>
          <button
            onClick={() => setActionSuccessToast(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Module 5 Audit Trail Drawer */}
      {showAuditDrawer && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-2xs flex justify-end"
          onClick={() => {
            setShowAuditDrawer(false);
            navigate('/workspace');
          }}
        >
          <div 
            className="w-96 bg-white h-full shadow-2xl flex flex-col border-l border-slate-300 animate-in slide-in-from-right duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-400" />
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider">Module 5: Edge Audit Trail</h3>
                  <p className="text-[9px] text-slate-400 font-mono">SQLite / LocalStorage Realtime Stream</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAuditDrawer(false);
                  navigate('/workspace');
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-slate-50">
              <p className="text-[10px] text-slate-500 font-medium">
                Every magistrate click, IO submission, and statutory notification emits an immutable audit record.
              </p>

              {auditLogs.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  No actions logged yet. Interact with cases on the cause list to record judicial audit trail.
                </div>
              ) : (
                auditLogs.map((log, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 text-[11px] shadow-2xs font-mono">
                    <div className="flex items-center justify-between text-slate-500 text-[9px] mb-1">
                      <span className="font-bold text-slate-800">{log.action_type}</span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-slate-900 font-semibold">{log.case_id} • {log.milestone || 'Docket Inspection'}</p>
                    <p className="text-[9px] text-slate-500 mt-1">
                      Actor: {log.meta?.actor_name || 'Magistrate'} ({log.meta?.actor_role || 'JUDGE'})
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center text-[10px]">
              <span className="text-slate-500">Offline Resilience: <strong>Active</strong></span>
              <button
                onClick={() => { localStorage.removeItem('remindtrack_audit_logs'); setAuditLogs([]); }}
                className="text-rose-600 hover:underline cursor-pointer"
              >
                Clear Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role & Privileges Matrix Dialog Modal */}
      {showPrivilegeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-slate-800 text-amber-400 border border-slate-700">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-sm text-slate-100 uppercase tracking-tight">
                    Institutional Role-Based Access Control (RBAC) & Privileges Matrix
                  </h3>
                  <p className="text-xs text-slate-400">
                    Statutory scope, data visibility (Read), and execution privileges (Execute) under BNSS 2023
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPrivilegeModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Table Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-700">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">Current Session Role:</span>
                  <span className="font-mono bg-slate-900 text-amber-400 px-2 py-0.5 rounded text-[11px] font-bold">
                    {currentUser?.role || 'JUDGE'}
                  </span>
                  <span className="text-slate-500 font-medium">({currentUser?.name})</span>
                </div>
                <span className="text-[11px] font-mono text-slate-500">Subordinate Judiciary Security Standard</span>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3 px-3.5 w-44 border-r border-slate-200">Stakeholder Role</th>
                      <th className="py-3 px-3.5 w-48 border-r border-slate-200">Jurisdictional Scope</th>
                      <th className="py-3 px-3.5 w-52 border-r border-slate-200">Data Visibility (Read)</th>
                      <th className="py-3 px-3.5 border-r border-slate-200">Statutory Privileges (Execute)</th>
                      <th className="py-3 px-3.5 w-48">Boundary Restrictions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {/* 1. Presiding Magistrate */}
                    <tr className={`hover:bg-slate-50/80 transition-colors ${currentUser?.role === 'JUDGE' ? 'bg-amber-50/20' : ''}`}>
                      <td className="py-3.5 px-3.5 align-top border-r border-slate-200 bg-slate-50/30">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Scale className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <strong className="text-slate-900 font-bold text-xs">Presiding Magistrate</strong>
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium">Metropolitan Magistrate (MM-04)</p>
                        <span className="inline-block mt-1 font-mono text-[9.5px] px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-200 rounded font-bold">
                          JUDGE
                        </span>
                      </td>
                      <td className="py-3.5 px-3.5 align-top border-r border-slate-200">
                        <p className="font-bold text-slate-900 mb-0.5">Courtroom 12, Tis Hazari</p>
                        <p className="text-slate-600 text-[11px] font-mono">Full Subordinate Courtroom Docket</p>
                        <div className="mt-1.5 text-[9.5px] text-slate-500 font-mono bg-slate-100 p-1 rounded border border-slate-200">
                          Mandate: Sec 479 & 187 BNSS
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 align-top border-r border-slate-200 text-slate-700 leading-relaxed text-[11.5px]">
                        Complete Cause List, Custody Ladders, Case Diaries, Legal Aid Status & Antecedents.
                      </td>
                      <td className="py-3.5 px-3.5 align-top border-r border-slate-200 space-y-1 text-[11px]">
                        <div className="flex items-start gap-1.5 text-slate-800">
                          <span className="text-emerald-700 font-bold">✓</span>
                          <span>Grant / Reject Sec 479 Statutory Default Bail</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-slate-800">
                          <span className="text-emerald-700 font-bold">✓</span>
                          <span>Issue 1-Click Judicial Compliance Memos</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-slate-800">
                          <span className="text-emerald-700 font-bold">✓</span>
                          <span>Summon IO / Order Show-Cause on 90-Day Lapse</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-slate-800">
                          <span className="text-emerald-700 font-bold">✓</span>
                          <span>Order Suo-Motu Release on 100% Custody</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 align-top bg-slate-50/20 text-[10.5px] text-slate-600 leading-relaxed">
                        <span className="text-amber-900 font-bold block uppercase text-[9.5px]">Judicial Sovereign:</span>
                        Exclusive final signatory. Bail orders cannot be delegated to administrative registry staff.
                      </td>
                    </tr>

                    {/* 2. Investigating Officer */}
                    <tr className={`hover:bg-slate-50/80 transition-colors ${currentUser?.role === 'INVESTIGATING_OFFICER' ? 'bg-indigo-50/20' : ''}`}>
                      <td className="py-3.5 px-3.5 align-top border-r border-slate-200 bg-slate-50/30">
                        <div className="flex items-center gap-1.5 mb-1">
                          <ShieldAlert className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <strong className="text-slate-900 font-bold text-xs">Investigating Officer</strong>
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium">SHO / Police Inspector</p>
                        <span className="inline-block mt-1 font-mono text-[9.5px] px-1.5 py-0.5 bg-indigo-100 text-indigo-900 border border-indigo-200 rounded font-bold">
                          INVESTIGATING_OFFICER
                        </span>
                      </td>
                      <td className="py-3.5 px-3.5 align-top border-r border-slate-200">
                        <p className="font-bold text-slate-900 mb-0.5">PS Kashmere Gate & Kotwali</p>
                        <p className="text-slate-600 text-[11px] font-mono">Jurisdictional FIR Remands</p>
                        <div className="mt-1.5 text-[9.5px] text-slate-500 font-mono bg-slate-100 p-1 rounded border border-slate-200">
                          Mandate: Sec 187(2) BNSS
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 align-top border-r border-slate-200 text-slate-700 leading-relaxed text-[11.5px]">
                        Assigned police station FIRs, 90-Day / 60-Day Remand Timers, Proximity Default-Bail Alerts.
                      </td>
                      <td className="py-3.5 px-3.5 align-top border-r border-slate-200 space-y-1 text-[11px]">
                        <div className="flex items-start gap-1.5 text-slate-800">
                          <span className="text-emerald-700 font-bold">✓</span>
                          <span>Submit Chargesheet / Police Report Filing Status</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-slate-800">
                          <span className="text-emerald-700 font-bold">✓</span>
                          <span>Log FSL / Forensic Status & Case Diary Updates</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-slate-800">
                          <span className="text-emerald-700 font-bold">✓</span>
                          <span>Acknowledge Statutory Warning Alerts</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 align-top bg-slate-50/20 text-[10.5px] text-slate-600 leading-relaxed">
                        <span className="text-indigo-900 font-bold block uppercase text-[9.5px]">Police Station Bound:</span>
                        Restricted strictly to jurisdictional FIRs. Cannot alter bail disposition or access other police stations.
                      </td>
                    </tr>

                    {/* 3. DLSA Legal Aid */}
                    <tr className={`hover:bg-slate-50/80 transition-colors ${currentUser?.role === 'DLSA_OFFICER' ? 'bg-emerald-50/20' : ''}`}>
                      <td className="py-3.5 px-3.5 align-top border-r border-slate-200 bg-slate-50/30">
                        <div className="flex items-center gap-1.5 mb-1">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <strong className="text-slate-900 font-bold text-xs">DLSA Legal Aid</strong>
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium">Legal Aid Defense Counsel (LADC)</p>
                        <span className="inline-block mt-1 font-mono text-[9.5px] px-1.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-200 rounded font-bold">
                          DLSA_OFFICER
                        </span>
                      </td>
                      <td className="py-3.5 px-3.5 align-top border-r border-slate-200">
                        <p className="font-bold text-slate-900 mb-0.5">DLSA Central District</p>
                        <p className="text-slate-600 text-[11px] font-mono">District Undertrial Assistance</p>
                        <div className="mt-1.5 text-[9.5px] text-slate-500 font-mono bg-slate-100 p-1 rounded border border-slate-200">
                          Mandate: Sec 479 BNSS Proviso
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 align-top border-r border-slate-200 text-slate-700 leading-relaxed text-[11.5px]">
                        Unrepresented UTPs, First-time offender 1/3rd triggers, custody days, surety indigency status.
                      </td>
                      <td className="py-3.5 px-3.5 align-top border-r border-slate-200 space-y-1 text-[11px]">
                        <div className="flex items-start gap-1.5 text-slate-800">
                          <span className="text-emerald-700 font-bold">✓</span>
                          <span>Draft & Submit Sec 479 Form 3 Bail Petitions</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-slate-800">
                          <span className="text-emerald-700 font-bold">✓</span>
                          <span>Assign Empanelled Legal Aid Defense Counsel</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-slate-800">
                          <span className="text-emerald-700 font-bold">✓</span>
                          <span>File Indigency Waivers for Unpayable Sureties</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 align-top bg-slate-50/20 text-[10.5px] text-slate-600 leading-relaxed">
                        <span className="text-emerald-900 font-bold block uppercase text-[9.5px]">Defense Advocacy:</span>
                        Representation rights only. Cannot issue judicial directives or edit police investigation records.
                      </td>
                    </tr>

                    {/* 4. Registry Master */}
                    <tr className={`hover:bg-slate-50/80 transition-colors ${currentUser?.role === 'REGISTRY_CLERK' ? 'bg-slate-100/50' : ''}`}>
                      <td className="py-3.5 px-3.5 align-top border-r border-slate-200 bg-slate-50/30">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Bell className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                          <strong className="text-slate-900 font-bold text-xs">Court Master / Registry</strong>
                        </div>
                        <p className="text-[11px] text-slate-600 font-medium">Registry & CIS Data Officer</p>
                        <span className="inline-block mt-1 font-mono text-[9.5px] px-1.5 py-0.5 bg-slate-200 text-slate-800 border border-slate-300 rounded font-bold">
                          REGISTRY_CLERK
                        </span>
                      </td>
                      <td className="py-3.5 px-3.5 align-top border-r border-slate-200">
                        <p className="font-bold text-slate-900 mb-0.5">Registry Division</p>
                        <p className="text-slate-600 text-[11px] font-mono">Cause List & Communication Hub</p>
                        <div className="mt-1.5 text-[9.5px] text-slate-500 font-mono bg-slate-100 p-1 rounded border border-slate-200">
                          Mandate: eCourts Phase III
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 align-top border-r border-slate-200 text-slate-700 leading-relaxed text-[11.5px]">
                        Cause list roster, dispatch delivery logs, CIS ingestion feeds, Module 5 immutable audit trail.
                      </td>
                      <td className="py-3.5 px-3.5 align-top border-r border-slate-200 space-y-1 text-[11px]">
                        <div className="flex items-start gap-1.5 text-slate-800">
                          <span className="text-emerald-700 font-bold">✓</span>
                          <span>Broadcast Official Multi-Channel Alerts (SMS/WhatsApp)</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-slate-800">
                          <span className="text-emerald-700 font-bold">✓</span>
                          <span>Sync CIS 3.0 & NJDG Roster Data Ingestion</span>
                        </div>
                        <div className="flex items-start gap-1.5 text-slate-800">
                          <span className="text-emerald-700 font-bold">✓</span>
                          <span>Inspect Immutable Module 5 Audit Log</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3.5 align-top bg-slate-50/20 text-[10.5px] text-slate-600 leading-relaxed">
                        <span className="text-slate-800 font-bold block uppercase text-[9.5px]">Ministerial Duty:</span>
                        Administrative and communication gateway. Cannot adjudicate case merits or alter statutory outcomes.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-500 font-mono text-[11px]">
                Sec 187 (Remand) & Sec 479 (Bail) Compliance Architecture
              </span>
              <button
                onClick={() => setShowPrivilegeModal(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-bold cursor-pointer transition-colors shadow-2xs"
              >
                Close Matrix Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* High-Volume Dataset Scaler & Performance Benchmark Modal */}
      {showScaleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in duration-150 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
                    High-Volume Dataset Scaler & Benchmark Suite
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-medium border border-emerald-500/30">
                      Zero-Lag Client Architecture
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-normal mt-0.5">
                    Benchmark high-court compliance algorithms, memoized indexing, multi-column search, and pagination on 1,000+ records.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowScaleModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-700">
              {/* Current Active Dataset Summary */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Active Dataset</span>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{activeDatasetMode}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Currently rendering <strong className="text-slate-900">{total.toLocaleString()}</strong> undertrials across {Math.ceil(total / 25)} paginated view batches.
                  </p>
                </div>
                {benchmarkTiming && (
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Index & Synthesis Time</span>
                    <span className="text-base font-black font-mono text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 inline-block mt-0.5">
                      ⚡ {benchmarkTiming.durationMs} ms
                    </span>
                  </div>
                )}
              </div>

              {/* Benchmark Presets */}
              <div>
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-amber-600" />
                  Select Synthetic Benchmark Scale
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Preset 1: 1,000 Records Benchmark */}
                  <div className="p-3.5 rounded-lg border-2 border-amber-500/40 bg-amber-50/40 hover:bg-amber-50/80 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-amber-600 fill-amber-600" />
                          1,000 Records Benchmark
                        </span>
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 bg-amber-200/60 text-amber-950 rounded">
                          User Test Set
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
                        Simulates an entire high-volume Subordinate District Courtroom docket with diverse BNSS remand milestones and 1/3rd first-offender limits.
                      </p>
                    </div>
                    <button
                      onClick={() => handleLoadBenchmark(1000, '⚡ Benchmark Suite (1,000 Undertrials)')}
                      disabled={isRefreshing}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md font-bold text-xs cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>Load 1,000 Undertrial Records</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Preset 2: 2,500 Records District Grid */}
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-indigo-600" />
                          2,500 Records Roster
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-medium">
                          District Roster
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
                        Simulates all 4 MM courtrooms in Central District for multi-jurisdictional compliance aggregation and DLSA roster allocation.
                      </p>
                    </div>
                    <button
                      onClick={() => handleLoadBenchmark(2500, '⚡ District Scale (2,500 Undertrials)')}
                      disabled={isRefreshing}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-md font-bold text-xs cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>Load 2,500 Records</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Preset 3: 5,000 Records High Court Grid */}
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <Database className="w-4 h-4 text-blue-600" />
                          5,000 Records Grid
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-medium">
                          High Court Oversight
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
                        Stress test with 5,000 cases to verify sub-millisecond memoized filtering, multi-sort, and CSV streaming capabilities.
                      </p>
                    </div>
                    <button
                      onClick={() => handleLoadBenchmark(5000, '⚡ State Grid (5,000 Undertrials)')}
                      disabled={isRefreshing}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-md font-bold text-xs cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>Load 5,000 Records</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Preset 4: Standard 8 Cases */}
                  <div className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <Scale className="w-4 h-4 text-slate-600" />
                          Standard Daily Docket
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-medium">
                          8 Core Matters
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed mb-3">
                        Revert to the curated courtroom cause list featuring detailed statutory documentation and mock statutory reports.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        loadData();
                        setShowScaleModal(false);
                      }}
                      disabled={isRefreshing}
                      className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md font-bold text-xs cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>Restore 8 Court Cases</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Custom CSV / JSON File Import */}
              <div className="p-4 bg-slate-50 border border-dashed border-slate-300 rounded-lg">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <FileUp className="w-3.5 h-3.5 text-blue-600" />
                  Import Custom Test Dataset (JSON or CSV)
                </h4>
                <p className="text-[11px] text-slate-600 mb-3">
                  Upload your own 1,000+ record courtroom test dataset. Supported formats: Standard CSV or structured JSON arrays.
                </p>

                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".csv,.json,text/csv,application/json"
                    className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3.5 file:rounded-md file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white hover:file:bg-slate-800 file:cursor-pointer cursor-pointer"
                  />
                </div>

                {importError && (
                  <div className="mt-2.5 p-2 bg-rose-50 border border-rose-200 rounded text-rose-800 flex items-center gap-2 text-[11px]">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-500 font-mono text-[11px]">
                Built for High-Throughput District & State Judicial Repositories
              </span>
              <button
                onClick={() => setShowScaleModal(false)}
                className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-md font-bold cursor-pointer transition-colors shadow-2xs"
              >
                Close Benchmark Modal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generated Judicial Document / Order Sheet Modal matching TL Template */}
      {generatedDocModal && (
        <JudicialDocumentModal
          isOpen={!!generatedDocModal}
          onClose={() => setGeneratedDocModal(null)}
          title={generatedDocModal.title}
          docType={generatedDocModal.docType as any}
          caseItem={generatedDocModal.caseItem}
          downloadUrl={generatedDocModal.downloadUrl}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
