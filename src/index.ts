/**
 * RemindTrack - Module 3: Magistrate Cause-List & Statutory Compliance Interface
 * Public Export Entrypoint
 */

// Core Module Components
export { CauseListModule } from './components/CauseListModule';
export type { CauseListModuleProps } from './components/CauseListModule';
export { LoginScreen } from './components/LoginScreen';

// Subcomponents
export { Header } from './components/Header';
export { SummaryCards } from './components/SummaryCards';
export { CauseListTable } from './components/CauseListTable';
export { CaseDetailPanel } from './components/CaseDetailPanel';
export { MilestoneTimeline } from './components/MilestoneTimeline';
export { StatusBadge } from './components/StatusBadge';
export { JudicialDocumentModal } from './components/JudicialDocumentModal';

// Types
export type {
  Case,
  ComplianceInfo,
  ComplianceStatus,
  AssignedOfficer,
  AssignedCounsel,
  NotificationRecord,
} from './types/case';

export type {
  UserRole,
  UserProfile,
  AuthSession,
} from './types/auth';

// API & Integration Service Hooks
export {
  fetchCauseList,
  requestJudicialDocument,
  emitAuditEvent,
} from './services/api';
export type { AuditEventPayload, JudicialDocumentType } from './services/api';

// Auth Services
export {
  MOCK_PERSONAS,
  getActiveSession,
  saveSession,
  clearSession,
  loginWithPersona,
  loginWithCredentials,
} from './services/auth';
