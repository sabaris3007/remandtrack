import { useState, useMemo, ChangeEvent, FormEvent } from 'react';
import { Case, ComplianceStatus } from '../types/case';
import { UserProfile } from '../types/auth';
import { StatusBadge } from './StatusBadge';
import { exportCasesToCSV } from '../utils/largeDatasetGenerator';
import { 
  Search, X, AlertTriangle, User, Shield, ChevronLeft, ChevronRight, 
  ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, 
  Download, Filter, SlidersHorizontal, Sparkles
} from 'lucide-react';

interface Props {
  cases: Case[];
  activeFilter: ComplianceStatus | 'ALL';
  onClearFilter: () => void;
  onSelectCase: (c: Case) => void;
  selectedCaseId?: string;
  onActionClick: (actionType: string, c: Case) => void;
  currentUser?: UserProfile | null;
  benchScope?: 'ALL' | 'MY_BENCH';
  onToggleBenchScope?: (scope: 'ALL' | 'MY_BENCH') => void;
}

type SortField = 'custody_percent' | 'custody_days' | 'accused_name' | 'remand_date' | 'docket_no' | 'police_station' | 'compliance_severity';
type SortOrder = 'asc' | 'desc';

export function CauseListTable({ 
  cases, 
  activeFilter, 
  onClearFilter, 
  onSelectCase, 
  selectedCaseId,
  onActionClick,
  currentUser,
  benchScope = 'ALL',
  onToggleBenchScope,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleScopeFilter, setRoleScopeFilter] = useState<'ALL' | 'ASSIGNED_TO_ME'>('ALL');
  
  // Advanced secondary filters for large scale exploration
  const [selectedStation, setSelectedStation] = useState<string>('ALL');
  const [selectedHierarchyFilter, setSelectedHierarchyFilter] = useState<string>('ALL');
  const [selectedRepStatus, setSelectedRepStatus] = useState<string>('ALL');
  const [firstOffenderOnly, setFirstOffenderOnly] = useState<boolean>(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState<boolean>(false);

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('custody_percent');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Pagination state (defaults to 50 rows per page for smooth 60fps rendering of 1,000+ datasets)
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [jumpPageInput, setJumpPageInput] = useState<string>('');

  // Extract unique police stations for quick filtering
  const availableStations = useMemo(() => {
    const set = new Set<string>();
    cases.forEach(c => {
      if (c.police_station) set.add(c.police_station);
    });
    return Array.from(set).sort();
  }, [cases]);

  // Priority weight for compliance severity sorting
  const severityWeight = (status: ComplianceStatus): number => {
    switch (status) {
      case 'RED': return 4;
      case 'ORANGE': return 3;
      case 'AMBER': return 2;
      case 'NORMAL': return 1;
      default: return 0;
    }
  };

  // High-performance memoized filter & sort pass
  const processedCases = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    // 1. Filtering
    const filtered = cases.filter(c => {
      // Compliance Status Filter
      if (activeFilter !== 'ALL' && c.compliance.status !== activeFilter) {
        return false;
      }

      // Police Station Filter
      if (selectedStation !== 'ALL' && c.police_station !== selectedStation) {
        return false;
      }

      // Enforce strict bench isolation for subordinate judges (JM-I, JM-II, JM-III)
      if (currentUser?.role === 'JUDGE' && currentUser.judge_hierarchy && currentUser.judge_hierarchy !== 'cjm') {
        if (c.judge_hierarchy && c.judge_hierarchy !== currentUser.judge_hierarchy) {
          return false;
        }
      }

      // Judge Hierarchy Filter (Only active for CJM across all benches)
      if (selectedHierarchyFilter !== 'ALL' && c.judge_hierarchy !== selectedHierarchyFilter) {
        return false;
      }

      // Representation Filter
      if (selectedRepStatus !== 'ALL' && c.representation_status !== selectedRepStatus) {
        return false;
      }

      // First-time Offender filter
      if (firstOffenderOnly && !c.first_time_offender) {
        return false;
      }

      // Role Scope Filter
      if (roleScopeFilter === 'ASSIGNED_TO_ME' && currentUser) {
        if (currentUser.role === 'JUDGE' && currentUser.judge_hierarchy) {
          if (c.judge_hierarchy && c.judge_hierarchy !== currentUser.judge_hierarchy) {
            return false;
          }
        } else if (currentUser.role === 'INVESTIGATING_OFFICER') {
          const myStations = currentUser.jurisdiction_stations || ['PS Kashmere Gate', 'PS Kotwali', 'Tirunelveli Town P.S'];
          const matchesStation = myStations.includes(c.police_station || '');
          const matchesIo = c.assigned_io?.name.includes('Shanmugam') || c.assigned_io?.name.includes('Meena') || c.assigned_io?.badge_no.includes('4109');
          if (!matchesStation && !matchesIo) return false;
        } else if (currentUser.role === 'DLSA_OFFICER') {
          if (c.representation_status !== 'Unrepresented' && c.representation_status !== 'DLSA Appointed') {
            return false;
          }
        }
      }

      // Text search
      if (term) {
        const accused = c.accused_name.toLowerCase();
        const caseId = c.case_id.toLowerCase();
        const hierarchy = (c.judge_hierarchy || '').toLowerCase();
        const cnr = (c.cnr_number || '').toLowerCase();
        const court = (c.court_name || '').toLowerCase();
        const jail = (c.jail_location || '').toLowerCase();
        const docket = (c.docket_no || '').toLowerCase();
        const fir = (c.fir_no || '').toLowerCase();
        const ps = (c.police_station || '').toLowerCase();
        const io = (c.assigned_io?.name || '').toLowerCase();
        const dlsa = (c.assigned_dlsa_counsel?.name || '').toLowerCase();
        const offence = (c.sections || c.offence_section).toLowerCase();
        const utp = (c.utp_number || '').toLowerCase();

        if (
          !accused.includes(term) &&
          !caseId.includes(term) &&
          !hierarchy.includes(term) &&
          !cnr.includes(term) &&
          !court.includes(term) &&
          !jail.includes(term) &&
          !docket.includes(term) &&
          !fir.includes(term) &&
          !ps.includes(term) &&
          !io.includes(term) &&
          !dlsa.includes(term) &&
          !offence.includes(term) &&
          !utp.includes(term)
        ) {
          return false;
        }
      }

      return true;
    });

    // 2. Sorting
    return filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'custody_percent': {
          const pctA = a.custody_days / (a.maximum_sentence_days || 1);
          const pctB = b.custody_days / (b.maximum_sentence_days || 1);
          comparison = pctA - pctB;
          break;
        }
        case 'custody_days':
          comparison = a.custody_days - b.custody_days;
          break;
        case 'compliance_severity':
          comparison = severityWeight(a.compliance.status) - severityWeight(b.compliance.status);
          break;
        case 'accused_name':
          comparison = a.accused_name.localeCompare(b.accused_name);
          break;
        case 'docket_no':
          comparison = (a.docket_no || a.case_id).localeCompare(b.docket_no || b.case_id);
          break;
        case 'police_station':
          comparison = (a.police_station || '').localeCompare(b.police_station || '');
          break;
        case 'remand_date':
          comparison = a.remand_date.localeCompare(b.remand_date);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [
    cases, 
    activeFilter, 
    searchTerm, 
    selectedStation, 
    selectedHierarchyFilter, 
    selectedRepStatus, 
    firstOffenderOnly, 
    roleScopeFilter, 
    currentUser, 
    sortField, 
    sortOrder
  ]);

  // Calculate pagination boundaries
  const totalCount = processedCases.length;
  const totalPages = pageSize === -1 ? 1 : Math.max(1, Math.ceil(totalCount / pageSize));
  
  // Safe page index clamp
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedCases = useMemo(() => {
    if (pageSize === -1) return processedCases;
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return processedCases.slice(startIndex, startIndex + pageSize);
  }, [processedCases, safeCurrentPage, pageSize]);

  // Handle Sort Header Toggle
  const handleHeaderSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // CSV Export Trigger
  const handleExportFilteredCSV = () => {
    const csvContent = exportCasesToCSV(processedCases);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `RemindTrack_CauseList_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle Jump to Page
  const handleJumpPage = (e: FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpPageInput, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      setJumpPageInput('');
    }
  };

  return (
    <div className="flex-1 border-r border-slate-200 flex flex-col bg-white overflow-hidden">
      <div className="py-2 px-6 border-b border-slate-200 flex flex-wrap justify-between items-center bg-slate-50 shrink-0 gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-slate-900 rounded-xs"></span>
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-900 font-display">
              Daily Cause List: Scheduled Undertrial Reviews
            </h2>
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-800 bg-white px-2 py-0.5 border border-slate-300 rounded shadow-2xs">
            {totalCount.toLocaleString()} of {cases.length.toLocaleString()} Matters Filtered
          </span>

          {currentUser && currentUser.role === 'JUDGE' && (
            <div>
              {currentUser.judge_hierarchy === 'cjm' ? (
                <span className="text-[11px] font-mono font-bold bg-indigo-50 text-indigo-950 px-2.5 py-0.5 border border-indigo-300 rounded shadow-2xs">
                  CJM Supervisory Authority • All Benches ({cases.length})
                </span>
              ) : (
                <span className="text-[11px] font-mono font-bold bg-amber-50 text-amber-950 px-2.5 py-0.5 border border-amber-300 rounded shadow-2xs">
                  Bench: {(currentUser.judge_hierarchy || 'JM-III').toUpperCase()} Assigned Docket
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search across records..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-8 pr-6 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 w-56 md:w-64 shadow-2xs font-medium"
            />
            {searchTerm && (
              <button 
                onClick={() => { setSearchTerm(''); setCurrentPage(1); }} 
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowFiltersPanel(prev => !prev)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs ${
              showFiltersPanel || selectedStation !== 'ALL' || selectedRepStatus !== 'ALL' || firstOffenderOnly
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters {(selectedStation !== 'ALL' || selectedRepStatus !== 'ALL' || firstOffenderOnly) ? '• Active' : ''}</span>
          </button>

          <button
            type="button"
            onClick={handleExportFilteredCSV}
            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-800 border border-slate-300 hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-700" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          {activeFilter !== 'ALL' && (
            <div className="flex items-center gap-1 bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg shadow-2xs">
              <span>Filter: {activeFilter}</span>
              <button 
                onClick={() => { onClearFilter(); setCurrentPage(1); }}
                className="hover:text-amber-300 ml-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {showFiltersPanel && (
        <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-300 flex flex-wrap items-center gap-3.5 text-xs animate-in fade-in duration-100">
          {(!currentUser || currentUser.judge_hierarchy === 'cjm') && (
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700 text-xs">Bench:</span>
              <select
                value={selectedHierarchyFilter}
                onChange={(e) => { setSelectedHierarchyFilter(e.target.value); setCurrentPage(1); }}
                className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 font-semibold"
              >
                <option value="ALL">All Court Benches (4 Hierarchies)</option>
                <option value="jm-I">JM-I (Judicial Magistrate - I)</option>
                <option value="jm-II">JM-II (Judicial Magistrate - II)</option>
                <option value="jm-III">JM-III (Judicial Magistrate - III)</option>
                <option value="cjm">CJM (Chief Judicial Magistrate)</option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-700 text-xs">Station:</span>
            <select
              value={selectedStation}
              onChange={(e) => { setSelectedStation(e.target.value); setCurrentPage(1); }}
              className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 font-semibold"
            >
              <option value="ALL">All Police Stations ({availableStations.length})</option>
              {availableStations.map(ps => (
                <option key={ps} value={ps}>{ps}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-700 text-xs">Counsel:</span>
            <select
              value={selectedRepStatus}
              onChange={(e) => { setSelectedRepStatus(e.target.value); setCurrentPage(1); }}
              className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 font-semibold"
            >
              <option value="ALL">All Legal Representation</option>
              <option value="DLSA Appointed">DLSA Appointed</option>
              <option value="Private Counsel">Private Counsel</option>
              <option value="Unrepresented">Unrepresented UTPs</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-800 select-none">
            <input
              type="checkbox"
              checked={firstOffenderOnly}
              onChange={(e) => { setFirstOffenderOnly(e.target.checked); setCurrentPage(1); }}
              className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <span>First-time Offender (Sec 479 1/3rd Proviso)</span>
          </label>

          {(selectedStation !== 'ALL' || selectedRepStatus !== 'ALL' || selectedHierarchyFilter !== 'ALL' || firstOffenderOnly) && (
            <button
              type="button"
              onClick={() => {
                setSelectedStation('ALL');
                setSelectedRepStatus('ALL');
                setSelectedHierarchyFilter('ALL');
                setFirstOffenderOnly(false);
                setCurrentPage(1);
              }}
              className="text-xs text-rose-700 hover:text-rose-900 font-bold underline cursor-pointer ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto bg-white">
        {totalCount === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <AlertTriangle className="w-10 h-10 text-slate-400 mx-auto" />
            <p className="font-bold text-sm text-slate-700">No scheduled cases match the active search/filters.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedStation('ALL');
                setSelectedRepStatus('ALL');
                setSelectedHierarchyFilter('ALL');
                setFirstOffenderOnly(false);
                onClearFilter();
              }}
              className="text-xs font-bold text-indigo-700 hover:underline cursor-pointer"
            >
              Clear all search and filter conditions
            </button>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 border-b border-slate-300 shadow-2xs">
              <tr>
                <th onClick={() => handleHeaderSort('compliance_severity')} className="py-2 pl-2 pr-1 w-16 sm:w-20 cursor-pointer hover:bg-slate-200/80 transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Alert</span>
                    {sortField === 'compliance_severity' ? (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-slate-950 font-bold" /> : <ArrowDown className="w-3 h-3 text-slate-950 font-bold" />) : <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-75" />}
                  </div>
                </th>
                <th onClick={() => handleHeaderSort('accused_name')} className="py-2 px-3 w-72 md:w-80 cursor-pointer hover:bg-slate-200/80 transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Accused / UTP / Docket</span>
                    {sortField === 'accused_name' ? (sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-slate-950 font-bold" /> : <ArrowDown className="w-3.5 h-3.5 text-slate-950 font-bold" />) : <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-75" />}
                  </div>
                </th>
                <th onClick={() => handleHeaderSort('police_station')} className="py-2 px-3 w-56 cursor-pointer hover:bg-slate-200/80 transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Assigned Stakeholders</span>
                    {sortField === 'police_station' ? (sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-slate-950 font-bold" /> : <ArrowDown className="w-3.5 h-3.5 text-slate-950 font-bold" />) : <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-75" />}
                  </div>
                </th>
                <th className="py-2 px-3 w-48"><span>Offence & Sentence</span></th>
                <th onClick={() => handleHeaderSort('custody_percent')} className="py-2 px-3 w-36 cursor-pointer hover:bg-slate-200/80 transition-colors">
                  <div className="flex items-center gap-1">
                    <span>Custody / Max</span>
                    {sortField === 'custody_percent' ? (sortOrder === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-slate-950 font-bold" /> : <ArrowDown className="w-3.5 h-3.5 text-slate-950 font-bold" />) : <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-75" />}
                  </div>
                </th>
                <th className="py-2 px-3 w-44"><span>Statutory Milestone</span></th>
                <th className="py-2 pr-5 w-36 text-right">{currentUser?.role === 'INVESTIGATING_OFFICER' ? 'Police Action' : currentUser?.role === 'DLSA_OFFICER' ? 'Legal Aid Action' : currentUser?.role === 'REGISTRY_CLERK' ? 'Registry Action' : 'Magistrate Action'}</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-slate-200">
              {paginatedCases.map(c => {
                const isSelected = selectedCaseId === c.case_id;
                let custodyPercent = Math.min(100, Math.round((c.custody_days / (c.maximum_sentence_days || 1)) * 100));
                
                // Subtle tinted gradient for each row (clean white base with a gentle hint of the alert color)
                let rowGradient = '';
                let progressColor = 'bg-slate-500';
                let custodyTextColor = 'text-slate-900';

                if (c.compliance.status === 'RED') {
                  rowGradient = isSelected 
                    ? 'bg-gradient-to-r from-red-100/90 via-red-50/40 to-white ring-2 ring-inset ring-red-600'
                    : 'bg-gradient-to-r from-red-100/40 via-red-50/15 to-white hover:from-red-100/70 hover:via-red-50/30 hover:to-white';
                  progressColor = 'bg-red-600';
                  custodyTextColor = 'text-red-900 font-black';
                } else if (c.compliance.status === 'ORANGE') {
                  rowGradient = isSelected 
                    ? 'bg-gradient-to-r from-orange-100/90 via-orange-50/40 to-white ring-2 ring-inset ring-orange-600'
                    : 'bg-gradient-to-r from-orange-100/40 via-orange-50/15 to-white hover:from-orange-100/70 hover:via-orange-50/30 hover:to-white';
                  progressColor = 'bg-orange-600';
                  custodyTextColor = 'text-orange-950 font-black';
                } else if (c.compliance.status === 'AMBER') {
                  rowGradient = isSelected 
                    ? 'bg-gradient-to-r from-amber-100/90 via-amber-50/40 to-white ring-2 ring-inset ring-amber-600'
                    : 'bg-gradient-to-r from-amber-100/40 via-amber-50/15 to-white hover:from-amber-100/70 hover:via-amber-50/30 hover:to-white';
                  progressColor = 'bg-amber-500';
                  custodyTextColor = 'text-amber-950 font-black';
                } else {
                  rowGradient = isSelected 
                    ? 'bg-gradient-to-r from-slate-100/90 via-slate-50/40 to-white ring-2 ring-inset ring-slate-600'
                    : 'bg-gradient-to-r from-slate-100/40 via-slate-50/10 to-white hover:from-slate-100/70 hover:via-slate-50/20 hover:to-white';
                }

                return (
                  <tr key={c.case_id} className={`transition-all cursor-pointer ${rowGradient}`} onClick={() => onSelectCase(c)}>
                    {/* Vertical curved edge bar */}
                    <td className="py-2.5 pl-0 pr-1 align-top">
                      <StatusBadge status={c.compliance.status} variant="bar" />
                    </td>
                    <td className="py-2.5 px-3 align-top">
                      <div>
                        <p className="font-bold text-sm text-slate-950 flex items-center gap-1.5 leading-tight">
                          {c.accused_name}
                          {c.utp_number && <span className="font-mono text-xs font-semibold text-slate-600">({c.utp_number})</span>}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-slate-700 font-mono">
                          <span className="font-bold text-slate-950">{c.docket_no || c.case_id}</span>
                          {c.cnr_number && <><span className="text-slate-400">•</span><span className="text-indigo-950 bg-indigo-50 px-1 py-0.2 rounded font-bold border border-indigo-200">CNR: {c.cnr_number}</span></>}
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-700 truncate max-w-[140px] font-medium">{c.police_station || 'PS Local'}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {c.judge_hierarchy && <span className="inline-block text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-950 border border-amber-300 uppercase">{c.judge_hierarchy}</span>}
                          {c.representation_status && <span className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded border ${c.representation_status === 'DLSA Appointed' ? 'bg-indigo-50 text-indigo-900 border-indigo-300' : c.representation_status === 'Unrepresented' ? 'bg-rose-50 text-rose-900 border-rose-300' : 'bg-slate-100 text-slate-800 border-slate-300'}`}>{c.representation_status}</span>}
                          {c.first_time_offender && <span className="inline-block text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-900 border border-emerald-300">1st Offender (1/3rd)</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 align-top text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-900"><Shield className="w-3.5 h-3.5 text-indigo-700 shrink-0" /><span className="font-bold text-xs">{c.assigned_io?.name || 'IO Unassigned'}</span></div>
                        <p className="text-xs text-slate-600 font-mono pl-5 font-medium">{c.assigned_io?.police_station || c.police_station} • {c.assigned_io?.badge_no}</p>
                        <div className="flex items-center gap-1.5 text-slate-800 pt-0.5"><User className="w-3.5 h-3.5 text-emerald-700 shrink-0" /><span className="text-xs">{c.assigned_dlsa_counsel?.name ? <strong className="text-emerald-950 font-bold">{c.assigned_dlsa_counsel.name}</strong> : <span className="text-rose-700 font-bold">Unrepresented UTP</span>}</span></div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 align-top">
                      <p className="font-bold text-slate-950 text-xs leading-snug">{c.offence_section}</p>
                      <p className="text-xs text-slate-600 mt-0.5 font-medium">Remand: <span className="font-mono text-slate-900 font-bold">{c.remand_date}</span></p>
                    </td>
                    <td className="py-2.5 px-3 align-top">
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <span className={`font-bold text-sm ${custodyTextColor}`}>{c.custody_days}d</span>
                        <span className="text-xs text-slate-500 font-semibold">/ {c.maximum_sentence_days}d</span>
                      </div>
                      <div className="w-24 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden shadow-inner"><div className={`h-full ${progressColor} transition-all`} style={{ width: `${custodyPercent}%` }} /></div>
                      <p className="text-xs text-slate-600 font-mono mt-0.5 font-semibold">{custodyPercent}% of max</p>
                    </td>
                    <td className="py-2.5 px-3 align-top">
                      <p className={`font-bold text-xs ${c.compliance.status === 'RED' ? 'text-red-900' : c.compliance.status === 'ORANGE' ? 'text-orange-950' : c.compliance.status === 'AMBER' ? 'text-amber-950' : 'text-slate-800'}`}>{c.compliance.milestone}</p>
                      {c.compliance.statutory_ref && <p className="text-xs text-slate-600 font-mono mt-0.5 font-semibold">{c.compliance.statutory_ref}</p>}
                    </td>
                    <td className="py-2.5 pr-5 align-top text-right">
                      {currentUser?.role === 'INVESTIGATING_OFFICER' ? (
                        <button 
                          className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer" 
                          onClick={(e) => { e.stopPropagation(); onSelectCase(c); }}
                        >
                          Submit Case Diary
                        </button>
                      ) : currentUser?.role === 'DLSA_OFFICER' ? (
                        <button 
                          className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer" 
                          onClick={(e) => { e.stopPropagation(); onSelectCase(c); }}
                        >
                          {c.representation_status === 'Unrepresented' ? 'Assign Counsel' : 'Bail Petition'}
                        </button>
                      ) : currentUser?.role === 'PRISON_AUTHORITY' ? (
                        <button 
                          className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer" 
                          onClick={(e) => { e.stopPropagation(); onSelectCase(c); }}
                        >
                          Custody Roll
                        </button>
                      ) : currentUser?.role === 'REGISTRY_CLERK' ? (
                        <button 
                          className="border border-slate-300 text-slate-900 bg-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer" 
                          onClick={(e) => { e.stopPropagation(); onSelectCase(c); }}
                        >
                          Dispatch Notice
                        </button>
                      ) : (
                        <>
                          {c.compliance.status === 'RED' && (
                            <button 
                              className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer" 
                              onClick={(e) => { e.stopPropagation(); onSelectCase(c); }}
                            >
                              Judicial Review
                            </button>
                          )}
                          {c.compliance.status === 'ORANGE' && (
                            <button 
                              className="border border-slate-400 text-slate-900 bg-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs hover:bg-slate-50 hover:border-slate-500 transition-colors cursor-pointer" 
                              onClick={(e) => { e.stopPropagation(); onSelectCase(c); }}
                            >
                              Review Memo
                            </button>
                          )}
                          {c.compliance.status === 'AMBER' && (
                            <button 
                              className="bg-indigo-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold ring-2 ring-indigo-200 hover:bg-indigo-800 transition-colors shadow-2xs cursor-pointer" 
                              onClick={(e) => { e.stopPropagation(); onSelectCase(c); }}
                            >
                              Issue Notice
                            </button>
                          )}
                          {c.compliance.status === 'NORMAL' && (
                            <button 
                              className="border border-slate-300 text-slate-700 bg-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 hover:text-slate-950 transition-colors shadow-2xs cursor-pointer" 
                              onClick={(e) => { e.stopPropagation(); onSelectCase(c); }}
                            >
                              Details
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="py-2 px-6 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 select-none">
        <div className="flex items-center gap-3.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-700 font-semibold text-xs">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value, 10));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded-md px-2 py-0.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer shadow-2xs font-bold"
            >
              <option value={25}>25 rows</option>
              <option value={50}>50 rows (Standard)</option>
              <option value={100}>100 rows</option>
              <option value={250}>250 rows</option>
              <option value={-1}>All ({totalCount.toLocaleString()})</option>
            </select>
          </div>

          {/* Showing X to Y of Z */}
          <span className="text-slate-600 font-mono text-xs font-semibold">
            {totalCount === 0 ? (
              '0 records'
            ) : pageSize === -1 ? (
              `Showing all ${totalCount.toLocaleString()} records`
            ) : (
              `Showing ${((safeCurrentPage - 1) * pageSize + 1).toLocaleString()}–${Math.min(safeCurrentPage * pageSize, totalCount).toLocaleString()} of ${totalCount.toLocaleString()} records`
            )}
          </span>
        </div>

        {/* Page Jump & Stepper Controls */}
        {pageSize !== -1 && totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            {/* Quick jump form */}
            <form onSubmit={handleJumpPage} className="flex items-center gap-1 mr-1">
              <span className="text-slate-600 text-xs font-semibold">Go to:</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpPageInput}
                onChange={(e) => setJumpPageInput(e.target.value)}
                placeholder={`${safeCurrentPage}`}
                className="w-12 px-1.5 py-0.5 text-center text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 font-bold"
              />
            </form>

            <button
              type="button"
              disabled={safeCurrentPage === 1}
              onClick={() => setCurrentPage(1)}
              className="p-1 rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-2xs font-bold"
              title="First Page"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              disabled={safeCurrentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="p-1 rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-2xs font-bold"
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <span className="px-1.5 font-mono text-xs font-bold text-slate-900">
              Page {safeCurrentPage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={safeCurrentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              className="p-1 rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-2xs font-bold"
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              disabled={safeCurrentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1 rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-2xs font-bold"
              title="Last Page"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
