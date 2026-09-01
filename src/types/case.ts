export type ComplianceStatus = 'NORMAL' | 'AMBER' | 'ORANGE' | 'RED';

export interface ComplianceInfo {
  status: ComplianceStatus;
  milestone?: string;
  reason?: string;
  statutory_ref?: string;
  milestone_date?: string;
}

export interface AssignedOfficer {
  name: string;
  badge_no: string;
  phone: string;
  police_station: string;
}

export interface AssignedCounsel {
  name: string;
  bar_reg_no: string;
  phone: string;
  assigned_date: string;
  counsel_type: 'DLSA Legal Aid' | 'Private';
}

export interface NotificationRecord {
  id: string;
  timestamp: string;
  recipient_role: 'INVESTIGATING_OFFICER' | 'DLSA_OFFICER' | 'JUDGE' | 'REGISTRY';
  recipient_name: string;
  channel: 'SMS' | 'WhatsApp' | 'eCourts_Portal' | 'Court_Memo';
  subject: string;
  status: 'DELIVERED' | 'DISPATCHED' | 'ACKNOWLEDGED';
}

export interface Case {
  case_id: string;
  cnr_number?: string;
  court_name?: string;
  jail_location?: string;
  docket_no?: string;
  fir_no?: string;
  police_station?: string;
  accused_name: string;
  utp_number?: string;
  offence_section: string;
  sections?: string;
  remand_date: string;
  chargesheet_date?: string | null;
  chargesheet_status: string;
  chargesheet_filed?: boolean;
  chargesheet_deadline?: string;
  maximum_sentence_days: number;
  max_sentence_days?: number;
  custody_days: number;
  first_time_offender?: boolean; // Eligible at 1/3rd (33.3%) threshold under BNSS 479(1) proviso
  is_first_offender?: boolean;
  has_counsel?: boolean;
  dlsa_unit?: string;
  judge_hierarchy?: string;
  representation_status?: 'DLSA Appointed' | 'Private Counsel' | 'Unrepresented';
  
  // Explicit Module Assignments
  assigned_judge: string;
  assigned_io: AssignedOfficer;
  assigned_dlsa_counsel?: AssignedCounsel | null;
  assigned_court_clerk: string;
  
  case_diary_status?: string;
  notification_history?: NotificationRecord[];
  
  compliance: ComplianceInfo;
}
