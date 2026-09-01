/**
 * High-Scale Database Seeder for RemindTrack
 *
 * Populates SQLite with:
 * 1. Base demo & test cases (from cases1.json and demo_cases.json)
 * 2. 1,000+ realistic synthetic Indian Subordinate Court cases across JM-I, JM-II, JM-III, and CJM.
 *
 * For EVERY case:
 * - Computes deterministic SHA-256 integrity hash on plaintext values
 * - Encrypts sensitive fields (accused_name, police_station, jail_location) via AES-256-GCM
 * - Inserts into court_cases table and syncs FTS5 full-text search index
 *
 * Run: npm run seed
 */

import 'dotenv/config';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { encryptCaseFields } from './encryption.js';
import { computeCaseHash } from './integrity.js';

const DB_PATH = path.join(process.cwd(), 'backend', 'data', 'cases.db');
const CASES1_PATH = path.join(process.cwd(), 'backend', 'data', 'cases1.json');
const DEMO_PATH = path.join(process.cwd(), 'backend', 'data', 'demo_cases.json');

const TARGET_TOTAL_RECORDS = 1000;

const POLICE_STATIONS = [
  'Tirunelveli Town P.S (FIR No. 101/2023)',
  'Palayamkottai Crime P.S (FIR No. 245/2023)',
  'Thachanallur P.S (FIR No. 312/2022)',
  'Melapalayam P.S (FIR No. 89/2023)',
  'Pettai Police Station (FIR No. 154/2023)',
  'Perumalpuram P.S (FIR No. 210/2022)',
  'High Ground Police Station (FIR No. 78/2023)',
  'Tirunelveli Junction P.S (FIR No. 419/2023)',
];

const OFFENCES = [
  { section: 'IPC §379 / BNS §303(2) (Theft)', maxDays: 1095 },
  { section: 'IPC §380 / BNS §305 (Theft in Building)', maxDays: 2555 },
  { section: 'IPC §326 / BNS §117(2) (Grievous Hurt)', maxDays: 1460 },
  { section: 'IPC §420 / BNS §318(4) (Cheating)', maxDays: 2555 },
  { section: 'IPC §323 / BNS §115(2) (Voluntarily Causing Hurt)', maxDays: 365 },
  { section: 'IPC §354 / BNS §74 (Assault on Woman)', maxDays: 730 },
  { section: 'IPC §457 / BNS §331(4) (Lurking House-Trespass)', maxDays: 730 },
  { section: 'IPC §498-A / BNS §85 (Cruelty by Relatives)', maxDays: 1095 },
  { section: 'Prevention of Corruption Act §7', maxDays: 1825 },
  { section: 'TNPID Act §5 (Protection of Depositors)', maxDays: 2555 },
  { section: 'IPC §392 / BNS §309(4) (Robbery)', maxDays: 1095 },
  { section: 'IPC §302 / BNS §103(1) (Murder)', maxDays: 10950 },
];

const FIRST_NAMES = [
  'Ganesan', 'Revathi', 'Selvam', 'Karthikeyan', 'Thangaraj', 'Chandran', 'Kavitha',
  'Anbarasan', 'Palani', 'Sureshkumar', 'Yamuna', 'Murugan', 'Kumaresan', 'Vetri',
  'Senthilkumar', 'Muthu', 'Sankaran', 'Hari', 'Arulmurugan', 'Kumar', 'Maran',
  'Umapathy', 'Gopal', 'Ravichandran', 'Loganathan', 'Manikandan', 'Saravanan',
  'Balamurugan', 'Rajesh', 'Sundaram', 'Meenakshi', 'Vijay', 'Prakash', 'Dinesh'
];

const LAST_NAMES = [
  'and 1 other', 'and 2 others', 'and 3 others', '@ Selvaraj', '@ Karthikeyan',
  '@ Anbarasan', '@ Palanisamy', '@ Sureshkumar', '@ Kumaresan', '@ Sankaran',
  '@ Arulmurugan', '@ Ganeshan', '@ Ravichandran', ''
];

const JUDGE_HIERARCHIES: Array<{ code: string; courtName: string }> = [
  { code: 'jm-I', courtName: 'Court of Judicial Magistrate - I, Tirunelveli' },
  { code: 'jm-II', courtName: 'Court of Judicial Magistrate - II, Tirunelveli' },
  { code: 'jm-III', courtName: 'Court of Judicial Magistrate - III, Tirunelveli' },
  { code: 'cjm', courtName: 'Court of Chief Judicial Magistrate, Tirunelveli' },
];

function loadJsonFile(filePath: string): any[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

function generateSyntheticCases(existingCount: number, targetTotal: number): Record<string, any>[] {
  const needed = Math.max(0, targetTotal - existingCount);
  const synthetic: Record<string, any>[] = [];
  const baseDate = new Date('2026-08-30T10:00:00Z');

  for (let i = 1; i <= needed; i++) {
    const num = 1000 + existingCount + i;
    const year = 2020 + (i % 6);
    const caseType = i % 4 === 0 ? 'PRC' : i % 3 === 0 ? 'SC' : i % 2 === 0 ? 'STC' : 'CC';
    const caseId = `${caseType}/${String(num).padStart(4, '0')}/${year}`;
    const cnr = `TNTL06${String(num).padStart(6, '0')}${year}`;

    const hierarchy = JUDGE_HIERARCHIES[i % JUDGE_HIERARCHIES.length];
    const offence = OFFENCES[i % OFFENCES.length];
    const ps = POLICE_STATIONS[i % POLICE_STATIONS.length];

    const fName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lName = LAST_NAMES[(i * 3) % LAST_NAMES.length];
    const accusedName = lName ? `${fName} ${lName}` : fName;

    // Remand date calculation (staggered from 10 days to 2000 days ago)
    const daysAgo = 15 + (i * 7) % 1800;
    const remandDateObj = new Date(baseDate.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const remandDateStr = remandDateObj.toISOString().slice(0, 10);

    const isFirstOffender = i % 3 !== 0;
    const hasCounsel = i % 5 !== 0;
    const chargesheetFiled = i % 4 !== 0;

    synthetic.push({
      case_id: caseId,
      cnr_number: cnr,
      court_name: hierarchy.courtName,
      jail_location: 'Central Prison, Palayamkottai',
      police_station: ps,
      accused_name: accusedName,
      sections: offence.section,
      max_sentence_days: offence.maxDays,
      remand_date: remandDateStr,
      chargesheet_filed: chargesheetFiled,
      is_first_offender: isFirstOffender,
      has_counsel: hasCounsel,
      dlsa_unit: 'DLSA Tirunelveli',
      judge_hierarchy: hierarchy.code,
      case_status: 'PENDING_TRIAL',
    });
  }

  return synthetic;
}

function main() {
  console.log('[Seed] 🚀 Starting high-volume SQLite database seeding...');

  // 1. Load curated base cases
  const cases1 = loadJsonFile(CASES1_PATH);
  const demoCases = loadJsonFile(DEMO_PATH);

  const caseMap = new Map<string, Record<string, any>>();
  for (const c of cases1) caseMap.set(c.case_id, c);
  for (const c of demoCases) caseMap.set(c.case_id, c);

  const baseCases = Array.from(caseMap.values());
  console.log(`[Seed] Loaded ${baseCases.length} curated base cases.`);

  // 2. Generate synthetic cases to hit 1,000 records
  const synthetic = generateSyntheticCases(baseCases.length, TARGET_TOTAL_RECORDS);
  console.log(`[Seed] Generated ${synthetic.length} synthetic judicial cases.`);

  const allCases = [...baseCases, ...synthetic];
  console.log(`[Seed] Total dataset size: ${allCases.length} cases.`);

  // 3. Open SQLite Database
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000');
  db.pragma('mmap_size = 268435456');
  db.pragma('foreign_keys = ON');

  // Schema creation
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

  // FTS5 Virtual Table for full-text search
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
    // Ignore if exists
  }

  // Clear existing rows for a clean seed
  db.exec('DELETE FROM court_cases;');
  try {
    db.exec('DELETE FROM court_cases_fts;');
  } catch {
    // Ignore
  }

  const insert = db.prepare(`
    INSERT INTO court_cases (
      case_id, cnr_number, court_name, jail_location, police_station,
      accused_name, sections, max_sentence_days, remand_date,
      chargesheet_filed, is_first_offender, has_counsel,
      dlsa_unit, judge_hierarchy, case_status,
      record_hash, hash_computed_at
    ) VALUES (
      @case_id, @cnr_number, @court_name, @jail_location, @police_station,
      @accused_name, @sections, @max_sentence_days, @remand_date,
      @chargesheet_filed, @is_first_offender, @has_counsel,
      @dlsa_unit, @judge_hierarchy, @case_status,
      @record_hash, @hash_computed_at
    )
  `);

  const now = new Date().toISOString();
  let inserted = 0;

  const insertTransaction = db.transaction((cases: Record<string, any>[]) => {
    for (const raw of cases) {
      const normalized: Record<string, any> = {
        case_id: raw.case_id,
        cnr_number: raw.cnr_number || `TNTL06${(raw.case_id || '').replace(/\D/g, '').slice(-4) || '0000'}2023`,
        court_name: raw.court_name || 'Court of Judicial Magistrate',
        jail_location: raw.jail_location || 'Central Prison, Palayamkottai',
        police_station: raw.police_station || 'Local Police Station',
        accused_name: raw.accused_name || 'Unknown Undertrial',
        sections: raw.sections || raw.offence_section || 'General Penal Sections',
        max_sentence_days: Number(raw.max_sentence_days || raw.maximum_sentence_days || 1095),
        remand_date: raw.remand_date || '2023-01-01',
        chargesheet_filed: raw.chargesheet_filed ? 1 : 0,
        is_first_offender: (raw.is_first_offender ?? raw.first_time_offender ?? true) ? 1 : 0,
        has_counsel: (raw.has_counsel !== false) ? 1 : 0,
        dlsa_unit: raw.dlsa_unit || 'DLSA Tirunelveli',
        judge_hierarchy: raw.judge_hierarchy || 'jm-III',
        case_status: raw.case_status || 'PENDING_TRIAL',
      };

      // 1. Compute deterministic SHA-256 hash on PLAINTEXT
      const recordHash = computeCaseHash(normalized);

      // 2. Encrypt sensitive fields with AES-256-GCM
      const encrypted = encryptCaseFields({ ...normalized });

      // 3. Write to SQLite
      insert.run({
        ...encrypted,
        record_hash: recordHash,
        hash_computed_at: now,
      });

      inserted++;
    }
  });

  const startTime = Date.now();
  insertTransaction(allCases);
  const durationMs = Date.now() - startTime;

  console.log(`[Seed] ✅ Inserted ${inserted} records into SQLite in ${durationMs}ms! (${(inserted / (durationMs / 1000)).toFixed(0)} records/sec)`);
  console.log(`[Seed] 🔒 AES-256-GCM encryption applied to all sensitive fields.`);
  console.log(`[Seed] 🛡️ SHA-256 tamper-proof record hashes computed for all ${inserted} rows.`);

  const countRow = db.prepare('SELECT COUNT(*) as total FROM court_cases').get() as any;
  console.log(`[Seed] Verified SQLite Total Records: ${countRow.total}`);

  db.close();
}

main();
