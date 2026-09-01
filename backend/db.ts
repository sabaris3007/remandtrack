/**
 * SQLite Data Access Layer for Case Records
 *
 * Replaces the flat-JSON loadCases() approach with proper indexed SQLite queries.
 * Uses better-sqlite3 for synchronous, high-performance access (no callback overhead).
 *
 * Features:
 * - Paginated queries with total count
 * - FTS5 full-text search across names, sections, FIRs
 * - Filtered queries by compliance status, court, judge hierarchy
 * - AES-256-GCM decryption of sensitive fields on read
 * - SHA-256 integrity hash verification
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { decryptCaseFields } from './encryption.js';
import { computeCaseHash, computeMerkleRoot, verifyAllCases, IntegrityReport } from './integrity.js';

const DB_PATH = path.join(process.cwd(), 'backend', 'data', 'cases.db');

let _db: Database.Database | null = null;

/**
 * Returns a singleton database connection with WAL mode and performance pragmas.
 */
export function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(DB_PATH);

  // Performance pragmas matching cases_schema.sql
  _db.pragma('journal_mode = WAL');
  _db.pragma('synchronous = NORMAL');
  _db.pragma('cache_size = -64000');       // 64MB cache
  _db.pragma('mmap_size = 268435456');     // 256MB memory-mapped I/O
  _db.pragma('temp_store = MEMORY');
  _db.pragma('foreign_keys = ON');

  // Ensure schema exists (idempotent)
  ensureSchema(_db);

  return _db;
}

/**
 * Creates the court_cases table and indexes if they don't exist.
 * Includes the record_hash column for tamper detection.
 */
function ensureSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS court_cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id VARCHAR(100) NOT NULL UNIQUE,
      cnr_number VARCHAR(16) NOT NULL UNIQUE,
      court_name VARCHAR(255) NOT NULL,
      jail_location VARCHAR(255) NOT NULL,
      police_station VARCHAR(255) NOT NULL,
      accused_name VARCHAR(255) NOT NULL,
      sections TEXT NOT NULL,
      max_sentence_days INTEGER NOT NULL,
      remand_date DATE NOT NULL,
      chargesheet_filed BOOLEAN NOT NULL DEFAULT 0,
      is_first_offender BOOLEAN NOT NULL DEFAULT 1,
      has_counsel BOOLEAN NOT NULL DEFAULT 1,
      dlsa_unit VARCHAR(255) NOT NULL,
      judge_hierarchy VARCHAR(50) DEFAULT NULL,
      case_status VARCHAR(50) NOT NULL DEFAULT 'PENDING_TRIAL',
      record_hash TEXT,
      hash_computed_at TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_cases_cnr ON court_cases (cnr_number);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_idx_cases_case_id ON court_cases (case_id);

    CREATE INDEX IF NOT EXISTS idx_cases_pending_chargesheet
      ON court_cases (remand_date, cnr_number)
      WHERE chargesheet_filed = 0;

    CREATE INDEX IF NOT EXISTS idx_cases_unrepresented
      ON court_cases (court_name, judge_hierarchy, dlsa_unit)
      WHERE has_counsel = 0;

    CREATE INDEX IF NOT EXISTS idx_cases_court_remand
      ON court_cases (court_name, judge_hierarchy, remand_date, case_status);

    CREATE INDEX IF NOT EXISTS idx_cases_jail_custody
      ON court_cases (jail_location, is_first_offender, remand_date);
  `);

  // FTS5 virtual table for instant search
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS court_cases_fts USING fts5(
        case_id,
        cnr_number,
        accused_name,
        police_station,
        sections,
        court_name,
        judge_hierarchy,
        content='court_cases',
        content_rowid='id'
      );
    `);
  } catch {
    // FTS5 might already exist with different schema, ignore
  }
}

export interface PaginatedResult<T> {
  cases: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CaseFilters {
  search?: string;
  judgeHierarchy?: string;
  courtName?: string;
  status?: string;         // compliance status filter will be applied post-evaluation
  chargesheetFiled?: boolean;
  hasCounsel?: boolean;
}

/**
 * Fetches cases from SQLite with pagination.
 * Decrypts sensitive fields before returning.
 */
export function getCasesPaginated(
  page: number = 1,
  pageSize: number = 50,
  filters: CaseFilters = {}
): PaginatedResult<Record<string, any>> {
  const db = getDb();

  const conditions: string[] = [];
  const params: any[] = [];

  if (filters.judgeHierarchy) {
    conditions.push('judge_hierarchy = ?');
    params.push(filters.judgeHierarchy);
  }
  if (filters.courtName) {
    conditions.push('court_name LIKE ?');
    params.push(`%${filters.courtName}%`);
  }
  if (filters.chargesheetFiled !== undefined) {
    conditions.push('chargesheet_filed = ?');
    params.push(filters.chargesheetFiled ? 1 : 0);
  }
  if (filters.hasCounsel !== undefined) {
    conditions.push('has_counsel = ?');
    params.push(filters.hasCounsel ? 1 : 0);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countRow = db.prepare(`SELECT COUNT(*) as total FROM court_cases ${whereClause}`).get(...params) as any;
  const total = countRow?.total || 0;

  // Get paginated rows
  const offset = (page - 1) * pageSize;
  const rows = db.prepare(
    `SELECT * FROM court_cases ${whereClause} ORDER BY remand_date ASC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset) as Record<string, any>[];

  // Decrypt sensitive fields
  const decryptedRows = rows.map(row => {
    const obj = { ...row };
    // Convert SQLite boolean integers back to booleans
    obj.chargesheet_filed = Boolean(obj.chargesheet_filed);
    obj.is_first_offender = Boolean(obj.is_first_offender);
    obj.has_counsel = Boolean(obj.has_counsel);
    return decryptCaseFields(obj);
  });

  return {
    cases: decryptedRows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Fetches ALL cases from SQLite (no pagination).
 * Used for backward compatibility with the existing frontend that expects the full array.
 */
export function getAllCases(): Record<string, any>[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM court_cases ORDER BY remand_date ASC').all() as Record<string, any>[];

  return rows.map(row => {
    const obj = { ...row };
    obj.chargesheet_filed = Boolean(obj.chargesheet_filed);
    obj.is_first_offender = Boolean(obj.is_first_offender);
    obj.has_counsel = Boolean(obj.has_counsel);
    return decryptCaseFields(obj);
  });
}

/**
 * Fetches a single case by case_id.
 */
export function getCaseById(caseId: string): Record<string, any> | undefined {
  const db = getDb();
  const row = db.prepare('SELECT * FROM court_cases WHERE case_id = ?').get(caseId) as Record<string, any> | undefined;
  if (!row) return undefined;

  const obj = { ...row };
  obj.chargesheet_filed = Boolean(obj.chargesheet_filed);
  obj.is_first_offender = Boolean(obj.is_first_offender);
  obj.has_counsel = Boolean(obj.has_counsel);
  return decryptCaseFields(obj);
}

/**
 * Full-text search across case fields using FTS5.
 * Falls back to LIKE queries if FTS5 isn't available.
 */
export function searchCases(query: string, limit: number = 50): Record<string, any>[] {
  const db = getDb();

  try {
    // Try FTS5 first — sub-millisecond search across all indexed fields
    const rows = db.prepare(`
      SELECT c.* FROM court_cases c
      INNER JOIN court_cases_fts fts ON c.id = fts.rowid
      WHERE court_cases_fts MATCH ?
      LIMIT ?
    `).all(query, limit) as Record<string, any>[];

    return rows.map(row => {
      const obj = { ...row };
      obj.chargesheet_filed = Boolean(obj.chargesheet_filed);
      obj.is_first_offender = Boolean(obj.is_first_offender);
      obj.has_counsel = Boolean(obj.has_counsel);
      return decryptCaseFields(obj);
    });
  } catch {
    // Fallback to LIKE search (slower but always works)
    const likeQuery = `%${query}%`;
    const rows = db.prepare(`
      SELECT * FROM court_cases
      WHERE case_id LIKE ? OR cnr_number LIKE ? OR accused_name LIKE ?
        OR police_station LIKE ? OR sections LIKE ? OR court_name LIKE ?
      LIMIT ?
    `).all(likeQuery, likeQuery, likeQuery, likeQuery, likeQuery, likeQuery, limit) as Record<string, any>[];

    return rows.map(row => {
      const obj = { ...row };
      obj.chargesheet_filed = Boolean(obj.chargesheet_filed);
      obj.is_first_offender = Boolean(obj.is_first_offender);
      obj.has_counsel = Boolean(obj.has_counsel);
      return decryptCaseFields(obj);
    });
  }
}

/**
 * Returns the total count of cases in the database.
 */
export function getTotalCaseCount(): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as total FROM court_cases').get() as any;
  return row?.total || 0;
}

/**
 * Runs full integrity verification on all case records.
 * Recomputes SHA-256 hashes and compares against stored hashes.
 */
export function verifyCaseIntegrity(): IntegrityReport {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM court_cases ORDER BY id ASC').all() as Record<string, any>[];

  // Build stored hash map and plaintext records
  const storedHashes = new Map<string, string>();
  const records: Record<string, any>[] = [];

  for (const row of rows) {
    const obj = { ...row };
    obj.chargesheet_filed = Boolean(obj.chargesheet_filed);
    obj.is_first_offender = Boolean(obj.is_first_offender);
    obj.has_counsel = Boolean(obj.has_counsel);

    // Decrypt for hash verification (hash is computed on plaintext)
    const decrypted = decryptCaseFields({ ...obj });
    records.push(decrypted);

    if (obj.record_hash) {
      storedHashes.set(obj.case_id, obj.record_hash);
    }
  }

  return verifyAllCases(records, storedHashes);
}

/**
 * Returns the current Merkle root for the entire case dataset.
 */
export function getMerkleRoot(): string {
  const db = getDb();
  const rows = db.prepare('SELECT record_hash FROM court_cases WHERE record_hash IS NOT NULL ORDER BY id ASC').all() as { record_hash: string }[];
  const hashes = rows.map(r => r.record_hash);
  return computeMerkleRoot(hashes);
}

/**
 * Returns the raw (encrypted) value of a field for demo purposes.
 * Useful for showing the jury that data is encrypted at rest.
 */
export function getEncryptedFieldDemo(caseId: string): Record<string, any> | undefined {
  const db = getDb();
  const row = db.prepare(
    'SELECT case_id, accused_name, police_station, jail_location, record_hash FROM court_cases WHERE case_id = ?'
  ).get(caseId) as Record<string, any> | undefined;
  return row || undefined;
}
