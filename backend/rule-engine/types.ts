/**
 * Deterministic Legal Rule Engine Types
 * Based on Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS) & Constitution of India Article 21
 */

export enum ComplianceState {
  NORMAL = "NORMAL",
  AMBER_ALERT = "AMBER_ALERT",
  ORANGE_ALERT = "ORANGE_ALERT",
  RED_ALERT = "RED_ALERT",
}

export interface LegalStatuteRef {
  code: string;
  section: string;
  title: string;
  previousCrpcSection?: string;
  statutoryLimitDescription: string;
  legalRemedy: string;
}

export interface UndertrialCaseInput {
  caseId: string;
  prisonerName?: string;
  remandDate: string; // ISO 8601 date (YYYY-MM-DD or full timestamp)
  evaluationDate?: string; // Defaults to current system date
  maxSentenceYears: number; // Max statutory term of imprisonment for the alleged offense
  isChargesheetFiled: boolean;
  chargesheetFiledDate?: string;
  isFirstTimeOffender?: boolean; // Under BNSS §479, 1/3rd threshold applies for first-time offenders
  isOffenseEligibleForDeathOrLife?: boolean; // Death or Life imprisonment exclusions under BNSS §479
  offenseCategory?: string; // e.g. "Theft (IPC 379/BNS 303)", "Cheating (IPC 420/BNS 318)"
}

export interface RuleEvaluationMetrics {
  detentionDays: number;
  maxSentenceDays: number;
  detentionPercentage: number; // e.g. 54.2%
  chargesheetDeadlineDays: 60 | 90;
  chargesheetDaysRemaining: number;
  halfTermDays: number;
  oneThirdTermDays: number;
  statutoryThresholdRatio: number; // 0.5 (50%) or 0.333 (1/3rd)
}

export interface RuleEvaluationResult {
  caseId: string;
  prisonerName?: string;
  state: ComplianceState;
  stateLabel: string;
  urgencyLevel: "LOW" | "ELEVATED" | "HIGH" | "CRITICAL";
  headline: string;
  legalBasis: string;
  actionRequired: string;
  statute: LegalStatuteRef;
  metrics: RuleEvaluationMetrics;
  deterministicCalculation: {
    remandTimestamp: number;
    evaluationTimestamp: number;
    rawTimeDifferenceMs: number;
    integerDaysElapsed: number;
    formulaApplied: string;
  };
  executionTimeUs: number; // Microseconds taken by the pure rule engine
}

export interface BatchEvaluationResponse {
  totalCases: number;
  evaluatedAt: string;
  executionTimeMs: number;
  averageLatencyPerCaseUs: number;
  hallucinationRatePercent: number; // Always 0.0% by mathematical determinism
  stateBreakdown: {
    normal: number;
    amberAlert: number;
    orangeAlert: number;
    redAlert: number;
  };
  results: RuleEvaluationResult[];
}

export interface BenchmarkResult {
  batchSize: number;
  totalDurationMs: number;
  averageLatencyPerCaseUs: number;
  throughputCasesPerSecond: number;
  isSub50msCompliant: boolean;
  hallucinationRatePercent: 0.0;
  timestamp: string;
}
