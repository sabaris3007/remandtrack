import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { evaluateUndertrialCase } from './backend/rule-engine/ruleEngine.js';
import { UndertrialCaseInput } from './backend/rule-engine/types.js';
import { getAllCases, getCasesPaginated, getCaseById, searchCases, getTotalCaseCount, verifyCaseIntegrity, getMerkleRoot, getEncryptedFieldDemo } from './backend/db.js';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL || 'http://127.0.0.1:8001';
const AUDIT_SERVICE_URL = process.env.AUDIT_SERVICE_URL || 'http://127.0.0.1:8002';
const DATA_PATH = path.join(process.cwd(), 'backend', 'data', 'cases1.json');
const DEMO_DATA_PATH = path.join(process.cwd(), 'backend', 'data', 'demo_cases.json');
const MERGED_DATA_PATH = path.join(process.cwd(), 'backend', 'data', 'merged_all_cases.json');
const generatedDir = path.join(process.cwd(), 'generated-documents');
fs.mkdirSync(generatedDir, { recursive: true });

app.use(express.json({ limit: '10mb' }));

function toFrontendCase(raw: any, result: ReturnType<typeof evaluateUndertrialCase>) {
  const stateMap: Record<string, 'NORMAL' | 'AMBER' | 'ORANGE' | 'RED'> = {
    NORMAL: 'NORMAL',
    AMBER_ALERT: 'AMBER',
    ORANGE_ALERT: 'ORANGE',
    RED_ALERT: 'RED',
  };
  const status = raw.compliance?.status || stateMap[result.state] || 'NORMAL';
  const maxDays = Number(raw.max_sentence_days || raw.maximum_sentence_days || result.metrics.maxSentenceDays || 1095);
  const custodyDays = Number(raw.custody_days || result.metrics.detentionDays || 0);
  const firstOffender = Boolean(raw.is_first_offender ?? raw.first_time_offender ?? true);
  const counsel = raw.representation_status || (raw.has_counsel ? 'DLSA Appointed' : 'Unrepresented');
  const assignedJudge = raw.assigned_judge || raw.court_name || 'Court of Judicial Magistrate';
  const cidNum = (raw.case_id || '').replace(/\D/g, '').slice(-4) || '1001';
  
  const assignedIO = raw.assigned_io || {
    name: 'Insp. M. Shanmugam',
    badge_no: `TN-DVAC-IO-${cidNum}`,
    phone: '+91 94432 10410',
    police_station: raw.police_station ? String(raw.police_station).split('(')[0].trim() : 'Local Police Station',
  };

  const assignedDlsa = raw.assigned_dlsa_counsel || (raw.has_counsel !== false ? {
    name: 'Adv. S. Ramasubramanian',
    bar_reg_no: 'MS/1842/2014',
    phone: '+91 98421 55678',
    assigned_date: raw.remand_date || '2023-05-10',
    counsel_type: 'DLSA Legal Aid',
  } : null);

  return {
    case_id: raw.case_id,
    cnr_number: raw.cnr_number || `TNTL06${cidNum}2023`,
    court_name: raw.court_name || assignedJudge,
    jail_location: raw.jail_location || 'Central Prison, Palayamkottai',
    docket_no: raw.docket_no || raw.case_id,
    fir_no: raw.fir_no || raw.police_station || 'FIR 101/2023',
    police_station: raw.police_station || 'PS Local',
    accused_name: raw.accused_name,
    utp_number: raw.utp_number || `UTP-PALAYAM-${cidNum}`,
    offence_section: raw.offence_section || raw.sections || 'General Penal Sections',
    sections: raw.sections || raw.offence_section || 'General Penal Sections',
    remand_date: raw.remand_date,
    chargesheet_date: raw.chargesheet_date || null,
    chargesheet_status: raw.chargesheet_status || (raw.chargesheet_filed ? 'Filed' : 'Not Filed (Investigation Pending)'),
    chargesheet_filed: Boolean(raw.chargesheet_filed),
    maximum_sentence_days: maxDays,
    max_sentence_days: maxDays,
    custody_days: custodyDays,
    first_time_offender: firstOffender,
    is_first_offender: firstOffender,
    has_counsel: Boolean(raw.has_counsel !== false),
    dlsa_unit: raw.dlsa_unit || 'DLSA Tirunelveli',
    judge_hierarchy: raw.judge_hierarchy || 'jm-III',
    representation_status: counsel,
    assigned_judge: assignedJudge,
    assigned_io: assignedIO,
    assigned_dlsa_counsel: assignedDlsa,
    assigned_court_clerk: raw.assigned_court_clerk || 'Thiru. K. Arumugam (Head Clerk)',
    case_diary_status: raw.case_diary_status || (result.headline + ' ' + result.actionRequired),
    notification_history: raw.notification_history || [],
    compliance: {
      status,
      milestone: raw.compliance?.milestone || result.stateLabel,
      statutory_ref: raw.compliance?.statutory_ref || result.statute.section,
      reason: raw.compliance?.reason || (result.headline + ' ' + result.actionRequired),
      milestone_date: raw.compliance?.milestone_date || raw.remand_date,
    },
  };
}

/**
 * Legacy JSON loader — only used as fallback when SQLite has no data.
 * The primary path now uses SQLite via backend/db.ts.
 */
function loadCasesFromJson(source: string = 'all'): any[] {
  if (source === 'module1') {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  }
  if (source === 'demo_only') {
    return JSON.parse(fs.readFileSync(DEMO_DATA_PATH, 'utf8'));
  }
  if (fs.existsSync(MERGED_DATA_PATH)) {
    return JSON.parse(fs.readFileSync(MERGED_DATA_PATH, 'utf8'));
  }
  const demoCases = JSON.parse(fs.readFileSync(DEMO_DATA_PATH, 'utf8'));
  const c1Cases = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const demoIds = new Set(demoCases.map((c: any) => c.case_id));
  const merged = [...demoCases];
  for (const c of c1Cases) {
    if (!demoIds.has(c.case_id)) {
      merged.push(c);
    }
  }
  return merged;
}

/**
 * Loads cases from SQLite (primary) or falls back to JSON files.
 * SQLite path provides indexed queries, encryption, and tamper detection.
 */
function loadCases(source: string = 'all'): any[] {
  try {
    const dbCount = getTotalCaseCount();
    if (dbCount > 0) {
      return getAllCases();
    }
  } catch (err: any) {
    console.warn('[RemindTrack] SQLite unavailable, falling back to JSON:', err?.message);
  }
  return loadCasesFromJson(source);
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'RemindTrack Integrated API', dataSource: 'SQLite + AES-256-GCM' }));

/**
 * Cause list endpoint — supports optional pagination.
 * Without page param: returns full array (backward compatible with existing frontend).
 * With page param: returns { cases, total, page, pageSize, totalPages }.
 */
app.get('/api/cause-list', (req, res) => {
  const page = req.query.page ? Number(req.query.page) : undefined;
  const pageSize = Number(req.query.pageSize || 50);
  const source = String(req.query.source || 'all');

  let rawCases: any[];

  if (page !== undefined) {
    // Paginated SQLite query
    try {
      const result = getCasesPaginated(page, pageSize, {
        judgeHierarchy: req.query.judge_hierarchy ? String(req.query.judge_hierarchy) : undefined,
      });
      const evaluated = result.cases.map((raw) => {
        const input: UndertrialCaseInput = {
          caseId: raw.case_id,
          prisonerName: raw.accused_name,
          remandDate: raw.remand_date,
          maxSentenceYears: Number(raw.max_sentence_days || raw.maximum_sentence_days || 1095) / 365,
          isChargesheetFiled: Boolean(raw.chargesheet_filed),
          isFirstTimeOffender: Boolean(raw.is_first_offender ?? raw.first_time_offender ?? true),
          offenseCategory: raw.sections || raw.offence_section,
        };
        return toFrontendCase(raw, evaluateUndertrialCase(input));
      });
      return res.json({
        cases: evaluated,
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      });
    } catch (err: any) {
      console.warn('[RemindTrack] Paginated query failed, falling back:', err?.message);
    }
  }

  // Non-paginated: full array (backward compatible)
  rawCases = loadCases(source);
  const results = rawCases.map((raw) => {
    const input: UndertrialCaseInput = {
      caseId: raw.case_id,
      prisonerName: raw.accused_name,
      remandDate: raw.remand_date,
      maxSentenceYears: Number(raw.max_sentence_days || raw.maximum_sentence_days || 1095) / 365,
      isChargesheetFiled: Boolean(raw.chargesheet_filed),
      isFirstTimeOffender: Boolean(raw.is_first_offender ?? raw.first_time_offender ?? true),
      offenseCategory: raw.sections || raw.offence_section,
    };
    return toFrontendCase(raw, evaluateUndertrialCase(input));
  });
  res.json(results);
});

/** Full-text search via FTS5 */
app.get('/api/cases/search', (req, res) => {
  const q = String(req.query.q || '');
  if (!q.trim()) return res.json([]);
  try {
    const results = searchCases(q);
    const evaluated = results.map((raw) => {
      const input: UndertrialCaseInput = {
        caseId: raw.case_id,
        prisonerName: raw.accused_name,
        remandDate: raw.remand_date,
        maxSentenceYears: Number(raw.max_sentence_days || 1095) / 365,
        isChargesheetFiled: Boolean(raw.chargesheet_filed),
        isFirstTimeOffender: Boolean(raw.is_first_offender),
        offenseCategory: raw.sections,
      };
      return toFrontendCase(raw, evaluateUndertrialCase(input));
    });
    res.json(evaluated);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Search failed' });
  }
});

/**
 * Integrity verification: recomputes SHA-256 hashes and reports any tampered records.
 * This is the tamper-proof endpoint for the jury.
 */
app.get('/api/cases/verify-integrity', (_req, res) => {
  try {
    const report = verifyCaseIntegrity();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Integrity check failed' });
  }
});

/** Returns the Merkle root — a single fingerprint for the entire dataset */
app.get('/api/cases/merkle-root', (_req, res) => {
  try {
    const root = getMerkleRoot();
    const count = getTotalCaseCount();
    res.json({ merkleRoot: root, totalRecords: count, computedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Merkle root computation failed' });
  }
});

/**
 * Demo endpoint: shows the RAW encrypted values stored in SQLite.
 * Useful for demonstrating to the jury that data is encrypted at rest.
 */
app.get('/api/cases/encrypted-demo/:caseId', (req, res) => {
  try {
    const raw = getEncryptedFieldDemo(req.params.caseId);
    if (!raw) return res.status(404).json({ error: 'Case not found' });
    res.json({ message: 'These are the raw AES-256-GCM encrypted values stored in SQLite', encrypted_fields: raw });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Demo failed' });
  }
});

/** Single case lookup by case_id — MUST come after all specific /api/cases/* routes */
app.get('/api/cases/:caseId', (req, res) => {
  try {
    const raw = getCaseById(req.params.caseId);
    if (!raw) return res.status(404).json({ error: 'Case not found' });
    const input: UndertrialCaseInput = {
      caseId: raw.case_id,
      prisonerName: raw.accused_name,
      remandDate: raw.remand_date,
      maxSentenceYears: Number(raw.max_sentence_days || 1095) / 365,
      isChargesheetFiled: Boolean(raw.chargesheet_filed),
      isFirstTimeOffender: Boolean(raw.is_first_offender),
      offenseCategory: raw.sections,
    };
    res.json(toFrontendCase(raw, evaluateUndertrialCase(input)));
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Internal error' });
  }
});

app.get('/api/rule-engine/statutes', async (_req, res) => {
  res.json({ service: 'Integrated deterministic rule engine', source: 'Module 2' });
});

function generateOfficialDocumentHtml(docType: string, caseData: any): { title: string; filename: string; html: string } {
  const caseId = caseData.case_id || caseData.docket_no || 'UNKNOWN';
  const cleanId = caseId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const accusedName = caseData.accused_name || caseData.prisoner_name || 'Accused';
  const courtName = caseData.court_name || caseData.court || 'Court of Judicial Magistrate';
  const policeStation = caseData.police_station || 'Police Station';
  const custodyDays = caseData.custody_days || caseData.days_in_custody || 0;
  const maxDays = caseData.maximum_sentence_days || caseData.max_sentence_days || 1095;
  const sections = caseData.sections || caseData.offence_section || 'Penal Sections';
  const remandDate = caseData.remand_date || caseData.date_of_arrest || 'N/A';
  const cnr = caseData.cnr_number || 'TNTL060000002023';
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  let title = 'STATUTORY JUDICIAL REVIEW ORDER SHEET';
  let filename = `Judicial_Order_Sheet_${cleanId}.html`;
  let headerColor = '#0f172a';
  let bannerText = `UNDER SECTION 479 BNSS 2023 / SECTION 436A CrPC`;
  let orderBody = ``;

  if (docType === 'io_inquiry') {
    title = 'STATUTORY NOTICE TO INVESTIGATING OFFICER (SECTION 187 BNSS)';
    filename = `IO_Notice_Sec187_${cleanId}.html`;
    bannerText = 'MANDATORY COMPLIANCE DIRECTIVE • SECTION 187(3) BNSS 2023';
    orderBody = `
      <p style="margin-top:12px; line-height:1.6;">
        <strong>TO:</strong> The Station House Officer / Investigating Officer,<br>
        <strong>Police Station:</strong> ${policeStation}<br>
        <strong>Reference FIR / Case:</strong> ${caseData.fir_no || policeStation} (Docket: ${caseId})
      </p>
      <div style="background:#fffbeb; border-left:4px solid #d97706; padding:12px; margin:16px 0; font-size:13px;">
        <strong>STATUTORY INVESTIGATION TIMELINE BREACH / EXPIRATION NOTICE:</strong><br>
        The accused <strong>${accusedName}</strong> has undergone continuous undertrial detention of <strong>${custodyDays} days</strong> since remand on <strong>${remandDate}</strong>.
        Under Section 187(3) of Bharatiya Nagarik Suraksha Sanhita, 2023, the statutory period for completion of investigation and submission of Final Police Report is expiring /      </div>
      <p style="line-height:1.6;">
        <strong>DIRECTIVE:</strong> You are hereby directed to submit the completed Case Diary and Final Police Report under Section 193 BNSS before this Court within <strong>24 HOURS</strong>, failing which the accused's statutory right to default bail shall be immediately determined by this Court in accordance with law.
      </p>
    `;
  } else if (docType === 'dlsa') {
    title = 'DISTRICT LEGAL SERVICES AUTHORITY (DLSA) LEGAL AID MANDATE';
    filename = `DLSA_Referral_Packet_${cleanId}.html`;
    bannerText = 'LEGAL AID INTERVENTION & BAIL PETITION DIRECTIVE • SEC 479 BNSS';
    orderBody = `
      <p style="margin-top:12px; line-height:1.6;">
        <strong>TO:</strong> The Secretary, District Legal Services Authority (DLSA),<br>
        <strong>Court Docket:</strong> ${caseId} &nbsp;|&nbsp; <strong>CNR:</strong> ${cnr}<br>
        <strong>Undertrial Prisoner:</strong> ${accusedName} (Custody: ${custodyDays} Days)
      </p>
      <div style="background:#f4f4f4; border:1px solid #000; padding:12px; margin:16px 0; font-size:13px;">
        <strong>LEGAL AID ASSIGNMENT MANDATE:</strong><br>
        The accused is currently undertrial in connection with offences under <strong>${sections}</strong>. 
        Custody has reached <strong>${custodyDays} of maximum ${maxDays} days</strong> (${Math.round((custodyDays/maxDays)*100)}%).
        Under Article 39A of the Constitution of India and Section 479(1) of BNSS 2023, the DLSA Legal Aid Defense Counsel is instructed to immediately prepare and move personal bond / statutory bail applications.
      </div>
    `;
  } else {
    // Judicial Review / Memo
    title = 'MANDATORY STATUTORY REVIEW ORDER SHEET (MAX CUSTODY CEILING)';
    filename = `Judicial_Review_Memo_${cleanId}.html`;
    bannerText = 'STATUTORY CUSTODY DETERMINATION • SECTION 479 BNSS 2023 / ART. 21';
    orderBody = `
      <div style="background:#f4f4f4; border:1px solid #000; padding:12px; margin:16px 0; font-size:13px;">
        <strong>MAXIMUM DETENTION CEILING SATURATION DETERMINATION:</strong><br>
        The undertrial accused <strong>${accusedName}</strong> (Docket: ${caseId}, CNR: ${cnr}) has completed <strong>${custodyDays} days</strong> in continuous judicial custody since <strong>${remandDate}</strong> against the statutory maximum sentence ceiling of <strong>${maxDays} days</strong> (${Math.round((custodyDays/maxDays)*100)}%).
      </div>
      <p style="line-height:1.6; margin-top:12px;">
        <strong>JUDICIAL ORDER:</strong><br>
        1. In terms of Section 479(1) / 479(2) BNSS 2023 and the mandate of personal liberty under Article 21 of the Constitution of India, continued incarceration beyond statutory limits is prohibited.<br>
        2. The Jail Superintendent, ${caseData.jail_location || 'Central Prison'}, is directed to verify the detention register and present the nominal roll of the undertrial.<br>
        3. Registry is directed to list this matter on priority for determination of release on personal bond with/without sureties.
      </p>
    `;
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: 'Times New Roman', serif; margin: 40px; color: #000; background: #fff; line-height: 1.5; }
    .header { text-align: center; border-bottom: 2px double #000; padding-bottom: 14px; margin-bottom: 20px; }
    .emblem { font-size: 12px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; color: #000; }
    .court-title { font-size: 16px; font-weight: bold; margin: 6px 0; text-transform: uppercase; }
    .sub-title { font-size: 11px; color: #000; font-family: monospace; }
    .banner { background: #f4f4f4; color: #000; border: 1px solid #000; padding: 6px 12px; font-size: 11.5px; font-weight: bold; text-align: center; letter-spacing: 1px; margin: 16px 0; }
    .table-docket { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
    .table-docket td { padding: 6px 10px; border: 1px solid #000; vertical-align: top; }
    .table-docket td.label { width: 28%; font-weight: bold; background: #f4f4f4; color: #000; }
    .footer { margin-top: 50px; display: flex; justify-content: space-between; align-items: flex-end; }
    .seal-box { border: 1px solid #000; width: 110px; height: 110px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #000; text-align: center; font-family: sans-serif; text-transform: uppercase; font-weight: bold; }
    .sig-box { text-align: center; }
    .sig-line { width: 220px; border-top: 1.5px solid #000; margin-top: 60px; padding-top: 6px; font-size: 12px; font-weight: bold; color: #000; }
    @media print {
      body { margin: 15mm; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; text-align: right;">
    <button onclick="window.print()" style="background:#000; color:#fff; padding:8px 16px; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-family:sans-serif;">Print / Save as PDF</button>
  </div>
  <div class="header">
    <div class="emblem">SUBORDINATE JUDICIARY OF INDIA</div>
    <div class="court-title">${courtName}</div>
    <div class="sub-title">REMANDTRACK STATUTORY COMPLIANCE PORTAL • BNSS 2023</div>
  </div>
  <div class="banner">${bannerText}</div>
  <table class="table-docket">
    <tr>
      <td class="label">Docket / Case ID:</td>
      <td><strong>${caseId}</strong></td>
      <td class="label">CNR Number:</td>
      <td><strong>${cnr}</strong></td>
    </tr>
    <tr>
      <td class="label">Accused / Undertrial:</td>
      <td><strong>${accusedName}</strong></td>
      <td class="label">Police Station / FIR:</td>
      <td>${policeStation}</td>
    </tr>
    <tr>
      <td class="label">Offence Sections:</td>
      <td>${sections}</td>
      <td class="label">Initial Remand Date:</td>
      <td>${remandDate}</td>
    </tr>
    <tr>
      <td class="label">Continuous Custody:</td>
      <td><strong>${custodyDays} Days</strong> (of max ${maxDays} days)</td>
      <td class="label">Issue Date:</td>
      <td>${dateStr}</td>
    </tr>
  </table>
  ${orderBody}
  <div class="footer">
    <div class="seal-box">Court Seal<br>Subordinate<br>Judiciary</div>
    <div class="sig-box">
      <div class="sig-line">Presiding Judicial Magistrate<br><span style="font-size:10.5px; font-weight:normal; color:#000;">${courtName}</span></div>
    </div>
  </div>
</body>
</html>`;

  return { title, filename, html };
}

import { execFileSync } from 'child_process';

function generatePdfWithPython(docType: string, caseData: any): { filename: string; bytes: Buffer } | null {
  try {
    const script = `
import sys, json, base64
from document_engine.pdf_engine import generate_judicial_memo, generate_io_notice, generate_dlsa_packet
from document_engine.integration_api import normalize_case

payload = json.loads(sys.stdin.read())
doc_type = payload.get("doc_type", "memo")
case_raw = payload.get("case", {})
c = normalize_case(case_raw)

if doc_type == "io_inquiry":
    pdf_bytes = generate_io_notice(c)
    fn = f"IO_Delay_Notice_{c['case_id'].replace('-', '_').replace('/', '_')}.pdf"
elif doc_type == "dlsa":
    pdf_bytes = generate_dlsa_packet(c)
    fn = f"DLSA_Packet_{c['case_id'].replace('-', '_').replace('/', '_')}.pdf"
else:
    pdf_bytes = generate_judicial_memo(c)
    fn = f"Judicial_Review_Memo_{c['case_id'].replace('-', '_').replace('/', '_')}.pdf"

print(json.dumps({"filename": fn, "pdf_b64": base64.b64encode(pdf_bytes).decode('utf-8')}))
`;
    const inputJson = JSON.stringify({ doc_type: docType, case: caseData });
    const out = execFileSync('python3', ['-c', script], { input: inputJson, encoding: 'utf8', timeout: 5000 });
    const res = JSON.parse(out.trim());
    return { filename: res.filename, bytes: Buffer.from(res.pdf_b64, 'base64') };
  } catch (err: any) {
    console.warn('[PDF Direct Engine] Fallback error:', err?.message || String(err));
    return null;
  }
}

app.post('/api/generate-document', async (req: Request, res: Response) => {
  const { doc_type, case: casePayload, ...flatCase } = req.body || {};
  const caseData = casePayload || flatCase;
  const endpoint = doc_type === 'io_inquiry'
    ? '/api/generate/io-notice'
    : doc_type === 'dlsa'
      ? '/api/generate/dlsa-packet'
      : '/api/generate/judicial-memo';

  // 1. Try upstream python microservice first (with 500ms timeout to never hang)
  try {
    const upstream = await fetch(`${PDF_SERVICE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ case: caseData }),
      signal: AbortSignal.timeout(500),
    });
    if (upstream.ok) {
      const bytes = Buffer.from(await upstream.arrayBuffer());
      const filename = upstream.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1]
        || `RemindTrack_${doc_type || 'order'}_${Date.now()}.pdf`;
      fs.writeFileSync(path.join(generatedDir, filename), bytes);
      return res.json({ 
        success: true, 
        download_url: `/generated-documents/${encodeURIComponent(filename)}`, 
        filename,
        message: 'Official Judicial Document PDF generated successfully.' 
      });
    }
  } catch (err: any) {
    // Microservice offline or timeout, fall through to direct python execution
  }

  // 2. Direct ReportLab engine generation via python
  const pythonPdf = generatePdfWithPython(doc_type, caseData);
  if (pythonPdf) {
    fs.writeFileSync(path.join(generatedDir, pythonPdf.filename), pythonPdf.bytes);
    return res.json({
      success: true,
      download_url: `/generated-documents/${encodeURIComponent(pythonPdf.filename)}`,
      filename: pythonPdf.filename,
      message: `Official court-ready ${pythonPdf.filename} generated successfully.`,
    });
  }

  // 3. Built-in high fidelity court document HTML fallback
  try {
    const doc = generateOfficialDocumentHtml(doc_type, caseData);
    fs.writeFileSync(path.join(generatedDir, doc.filename), doc.html, 'utf8');
    return res.json({
      success: true,
      download_url: `/generated-documents/${encodeURIComponent(doc.filename)}`,
      filename: doc.filename,
      message: `Official ${doc.title} generated successfully.`,
      document_html: doc.html,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to generate document', details: err?.message || String(err) });
  }
});

app.use('/generated-documents', express.static(generatedDir));

app.post('/api/audit-log', async (req: Request, res: Response) => {
  try {
    const upstream = await fetch(`${AUDIT_SERVICE_URL}/api/audit-log`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err: any) {
    res.status(503).json({ success: false, error: 'Audit service unavailable', details: err?.message || String(err) });
  }
});

app.get('/api/audit/events', async (_req, res) => {
  try {
    const upstream = await fetch(`${AUDIT_SERVICE_URL}/api/audit/events`);
    res.status(upstream.status).json(await upstream.json());
  } catch (err: any) {
    res.status(503).json({ error: 'Audit service unavailable', details: err?.message || String(err) });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);

    // Development SPA HTML fallback for direct navigation & refreshes on /login, /workspace, /audit, etc.
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/generated-documents')) {
        return next();
      }
      try {
        const template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`[RemindTrack] http://localhost:${PORT}`));
}

startServer();
