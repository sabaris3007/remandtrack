import { Case, ComplianceStatus } from '../types/case';

const POLICE_STATIONS = [
  'PS Kotwali',
  'PS Kashmere Gate',
  'PS Civil Lines',
  'PS Timarpur',
  'PS Chandni Chowk',
  'PS Lahori Gate',
  'PS Sadar Bazar',
  'PS Bara Hindu Rao',
  'PS Daryaganj',
  'PS Jama Masjid',
  'PS Hauz Qazi',
  'PS Karol Bagh',
  'PS DBG Road',
  'PS Nabi Karim',
  'PS Paharganj'
];

const OFFENCES = [
  { section: 'Sec 379 IPC / Sec 303(2) BNS', name: 'Theft (Max 3 Yrs / 1095 Days)', maxDays: 1095 },
  { section: 'Sec 380 IPC / Sec 305 BNS', name: 'Theft in Dwelling House (Max 7 Yrs / 2555 Days)', maxDays: 2555 },
  { section: 'Sec 325 IPC / Sec 117(2) BNS', name: 'Voluntarily Causing Grievous Hurt (Max 7 Yrs / 2555 Days)', maxDays: 2555 },
  { section: 'Sec 420 IPC / Sec 318(4) BNS', name: 'Cheating and Dishonestly Inducing Delivery (Max 7 Yrs / 2555 Days)', maxDays: 2555 },
  { section: 'Sec 323 IPC / Sec 115(2) BNS', name: 'Voluntarily Causing Hurt (Max 1 Yr / 365 Days)', maxDays: 365 },
  { section: 'Sec 354 IPC / Sec 74 BNS', name: 'Assault to Outrage Modesty (Max 5 Yrs / 1825 Days)', maxDays: 1825 },
  { section: 'Sec 411 IPC / Sec 317(2) BNS', name: 'Dishonestly Receiving Stolen Property (Max 3 Yrs / 1095 Days)', maxDays: 1095 },
  { section: 'Sec 406 IPC / Sec 316(2) BNS', name: 'Criminal Breach of Trust (Max 3 Yrs / 1095 Days)', maxDays: 1095 },
  { section: 'Sec 457 IPC / Sec 331(4) BNS', name: 'Lurking House-Trespass by Night (Max 5 Yrs / 1825 Days)', maxDays: 1825 },
  { section: 'Sec 506 IPC / Sec 351(2) BNS', name: 'Criminal Intimidation (Max 2 Yrs / 730 Days)', maxDays: 730 },
  { section: 'Sec 304A IPC / Sec 106(1) BNS', name: 'Causing Death by Negligence (Max 2 Yrs / 730 Days)', maxDays: 730 },
  { section: 'Sec 279 IPC / Sec 281 BNS', name: 'Rash Driving on Public Way (Max 6 Mos / 180 Days)', maxDays: 180 }
];

const FIRST_NAMES = [
  'Rajesh', 'Mohammad', 'Suresh', 'Amit', 'Sunil', 'Ramesh', 'Vikas', 'Pooja', 'Sunita', 'Deepak',
  'Manoj', 'Anil', 'Rakesh', 'Sanjay', 'Mukesh', 'Dinesh', 'Vinod', 'Pankaj', 'Vijay', 'Rahul',
  'Gopal', 'Santosh', 'Ashok', 'Neeraj', 'Kavita', 'Geeta', 'Rekha', 'Manju', 'Shabnam', 'Farooq',
  'Imran', 'Arjun', 'Rohit', 'Kishan', 'Balram', 'Joginder', 'Ravinder', 'Satish', 'Pradeep', 'Ajay',
  'Kamal', 'Naresh', 'Chandan', 'Babloo', 'Lalit', 'Suraj', 'Harish', 'Gaurav', 'Naveen', 'Devendra'
];

const LAST_NAMES = [
  'Kumar', 'Singh', 'Sharma', 'Verma', 'Yadav', 'Gupta', 'Khan', 'Mishra', 'Paswan', 'Ali',
  'Chauhan', 'Thakur', 'Rawat', 'Pandey', 'Devi', 'Begum', 'Ansari', 'Shukla', 'Patel', 'Das',
  'Jha', 'Tiwari', 'Gautam', 'Srivastava', 'Choudhary', 'Meena', 'Prasad', 'Lal', 'Kashyap', 'Pal'
];

const IO_NAMES = [
  'Insp. R.K. Meena', 'SI Harish Chander', 'Insp. Devendra Tyagi', 'SI Vikram Rawat',
  'Insp. Satbir Singh', 'SI Anita Kaushik', 'Insp. Mukesh Yadav', 'SI Rameshwar Dayal',
  'Insp. P.K. Jha', 'SI Kuldeep Nagar', 'Insp. Surender Tomar', 'SI Jagdish Prasad'
];

const DLSA_COUNSELS = [
  'Adv. Meenakshi Sundaram', 'Adv. Tariq Anwar', 'Adv. Preeti Deshmukh', 'Adv. Harishankar Rai',
  'Adv. Nivedita Sen', 'Adv. Alok Ranjan', 'Adv. Farhan Qureshi', 'Adv. Shweta Kulkarni'
];

/**
 * Computes deterministic BNSS compliance status and milestone notes for any case record
 */
export function computeStatutoryCompliance(
  custodyDays: number,
  maxSentenceDays: number,
  firstTimeOffender: boolean,
  chargesheetStatus: string,
  remandDaysAgo: number
): { status: ComplianceStatus; milestone: string; statutory_ref: string; reason: string } {
  // 1. Max sentence ceiling breach (100% custody)
  if (custodyDays >= maxSentenceDays) {
    return {
      status: 'RED',
      milestone: 'Max Term Reached (100%)',
      statutory_ref: 'Sec 479(2) BNSS / Sec 436A CrPC',
      reason: `Detention of ${custodyDays} days exceeds the statutory ceiling of ${maxSentenceDays} days. Mandatory statutory release / immediate judicial review triggered.`
    };
  }

  // 2. Default Bail on 90-Day Investigation Remand Breach (Sec 187(2) BNSS)
  if (chargesheetStatus !== 'Filed' && remandDaysAgo >= 90) {
    return {
      status: 'RED',
      milestone: 'Sec 187 Remand Breached (90d)',
      statutory_ref: 'Sec 187(2) BNSS / Sec 167(2) CrPC',
      reason: `Police report not filed within the 90-day statutory remand window (${remandDaysAgo} days elapsed). Indefeasible right to default bail accrued.`
    };
  }

  // 3. Section 479(1) Proviso: 1/3rd (33.3%) threshold for first-time offenders
  const thirdThreshold = Math.floor(maxSentenceDays / 3);
  if (firstTimeOffender && custodyDays >= thirdThreshold) {
    return {
      status: 'ORANGE',
      milestone: '1/3rd Term Reached (First Offender)',
      statutory_ref: 'Sec 479(1) Proviso BNSS',
      reason: `First-time offender has completed ${custodyDays} days (≥ 1/3rd of max ${maxSentenceDays} days). Entitled to personal bond release consideration.`
    };
  }

  // 4. Section 479(1) General: 1/2 (50%) threshold for regular undertrials
  const halfThreshold = Math.floor(maxSentenceDays / 2);
  if (custodyDays >= halfThreshold) {
    return {
      status: 'ORANGE',
      milestone: 'Half-Term Reached (50%)',
      statutory_ref: 'Sec 479(1) BNSS / Sec 436A CrPC',
      reason: `Undertrial has completed ${custodyDays} days (≥ 50% of max ${maxSentenceDays} days). Eligible for statutory bail on personal bond.`
    };
  }

  // 5. Section 187 Proximity Alert (Within 15 days of 90-day limit)
  if (chargesheetStatus !== 'Filed' && remandDaysAgo >= 75) {
    return {
      status: 'AMBER',
      milestone: `Impending 90-Day Lapse (${90 - remandDaysAgo}d left)`,
      statutory_ref: 'Sec 187(3) BNSS',
      reason: `Investigation in progress at day ${remandDaysAgo}. Only ${90 - remandDaysAgo} days remain before mandatory Section 187 default bail accrues.`
    };
  }

  // 6. Section 479 Proximity Alert (Within 30 days of half-term or 1/3rd term)
  const targetThreshold = firstTimeOffender ? thirdThreshold : halfThreshold;
  if (custodyDays >= targetThreshold - 30) {
    return {
      status: 'AMBER',
      milestone: `Approaching ${firstTimeOffender ? '1/3rd' : 'Half-Term'} (${targetThreshold - custodyDays}d left)`,
      statutory_ref: 'Sec 479 BNSS Early Warning',
      reason: `Undertrial is within ${targetThreshold - custodyDays} days of attaining statutory release eligibility.`
    };
  }

  // 7. Normal lawful detention
  return {
    status: 'NORMAL',
    milestone: 'Standard Judicial Remand',
    statutory_ref: 'Sec 187 BNSS',
    reason: `Remand ongoing within statutory limits (${custodyDays}/${maxSentenceDays} days). Next hearing scheduled.`
  };
}

/**
 * Generates N realistic, fully populated Indian Judicial Undertrial Cases
 * Designed for high-speed benchmark testing with 1,000 to 10,000 records.
 */
export function generateLargeDataset(count: number = 1000): Case[] {
  const result: Case[] = [];
  const baseYear = 2026;
  const today = new Date('2026-08-29T10:00:00Z');

  for (let i = 1; i <= count; i++) {
    const caseId = `C-${10000 + i}`;
    const year = 2023 + (i % 4);
    const docketNo = `CC/${2000 + (i % 8000)}/${year}`;
    const firNo = `FIR ${100 + (i % 600)}/${year}`;
    const ps = POLICE_STATIONS[i % POLICE_STATIONS.length];

    const fName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lName = LAST_NAMES[(i * 3) % LAST_NAMES.length];
    const accusedName = `${fName} ${lName}`;
    const utpNumber = `UTP-${year}-${String(1000 + (i % 9000)).padStart(4, '0')}`;

    const offenceObj = OFFENCES[i % OFFENCES.length];
    const firstTimeOffender = (i % 3 === 0) || (i % 7 === 0);

    // Generate balanced distribution of custody durations for statutory testing:
    // ~10% RED (over max or over 90d remand without CS)
    // ~25% ORANGE (half-term or 1/3rd term reached)
    // ~20% AMBER (near 90d or near half-term)
    // ~45% NORMAL
    let custodyDays: number;
    let chargesheetStatus = 'Filed';
    let chargesheetDate: string | null = '15 May ' + year;
    let remandDaysAgo: number;

    const profileType = i % 10;
    if (profileType === 0) {
      // RED: 100% max sentence exceeded
      custodyDays = offenceObj.maxDays + (i % 45) + 1;
      remandDaysAgo = custodyDays;
    } else if (profileType === 1) {
      // RED: 90-day remand breach without chargesheet
      remandDaysAgo = 91 + (i % 30);
      custodyDays = remandDaysAgo;
      chargesheetStatus = 'Pending (Default Bail Accrued)';
      chargesheetDate = null;
    } else if (profileType === 2 || profileType === 3) {
      // ORANGE: Half term or 1/3rd term
      if (firstTimeOffender) {
        custodyDays = Math.floor(offenceObj.maxDays / 3) + (i % 20);
      } else {
        custodyDays = Math.floor(offenceObj.maxDays / 2) + (i % 30);
      }
      remandDaysAgo = custodyDays;
    } else if (profileType === 4 || profileType === 5) {
      // AMBER: Impending statutory threshold
      if (i % 2 === 0) {
        remandDaysAgo = 78 + (i % 11);
        custodyDays = remandDaysAgo;
        chargesheetStatus = 'Pending (FSL Awaited)';
        chargesheetDate = null;
      } else {
        const target = firstTimeOffender ? Math.floor(offenceObj.maxDays / 3) : Math.floor(offenceObj.maxDays / 2);
        custodyDays = Math.max(10, target - 15 + (i % 10));
        remandDaysAgo = custodyDays;
      }
    } else {
      // NORMAL
      custodyDays = Math.max(5, Math.floor((offenceObj.maxDays * 0.15) + (i % 40)));
      remandDaysAgo = custodyDays;
      if (remandDaysAgo < 60 && i % 3 === 0) {
        chargesheetStatus = 'Investigation in Progress';
        chargesheetDate = null;
      }
    }

    const remandDateObj = new Date(today.getTime() - remandDaysAgo * 24 * 60 * 60 * 1000);
    const remandDateStr = remandDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    const compliance = computeStatutoryCompliance(
      custodyDays,
      offenceObj.maxDays,
      firstTimeOffender,
      chargesheetStatus,
      remandDaysAgo
    );

    const repType: 'DLSA Appointed' | 'Private Counsel' | 'Unrepresented' = 
      (i % 5 === 0) ? 'Unrepresented' : (i % 3 === 0) ? 'Private Counsel' : 'DLSA Appointed';

    const ioIndex = (i + 1) % IO_NAMES.length;
    const dlsaIndex = i % DLSA_COUNSELS.length;

    const judgeHierarchies = ['jm-III', 'jm-I', 'jm-II', 'cjm'];
    const assignedHierarchy = judgeHierarchies[i % judgeHierarchies.length];
    const courtBenchMap: Record<string, string> = {
      'jm-I': 'Court of Judicial Magistrate - I',
      'jm-II': 'Court of Judicial Magistrate - II',
      'jm-III': 'Court of Judicial Magistrate - III, Tirunelveli',
      'cjm': 'Court of Chief Judicial Magistrate (CJM)',
    };
    const courtName = courtBenchMap[assignedHierarchy] || 'Court of Judicial Magistrate - III, Tirunelveli';

    result.push({
      case_id: caseId,
      docket_no: docketNo,
      cnr_number: `TNTL0604${String(10000 + i).slice(1)}2026`,
      court_name: courtName,
      jail_location: 'Central Prison, Palayamkottai',
      fir_no: firNo,
      police_station: ps,
      accused_name: accusedName,
      utp_number: utpNumber,
      offence_section: `${offenceObj.section} (${offenceObj.name})`,
      sections: offenceObj.section,
      remand_date: remandDateStr,
      chargesheet_date: chargesheetDate,
      chargesheet_status: chargesheetStatus,
      chargesheet_filed: chargesheetStatus === 'Filed',
      maximum_sentence_days: offenceObj.maxDays,
      max_sentence_days: offenceObj.maxDays,
      custody_days: custodyDays,
      first_time_offender: firstTimeOffender,
      is_first_offender: firstTimeOffender,
      has_counsel: repType !== 'Unrepresented',
      dlsa_unit: 'DLSA Tirunelveli',
      judge_hierarchy: assignedHierarchy,
      representation_status: repType,
      assigned_judge: courtName,
      assigned_io: {
        name: IO_NAMES[ioIndex],
        badge_no: `DL-POL-${2000 + ioIndex}`,
        phone: `+91 9810${(10000 + ioIndex).toString().slice(1)}`,
        police_station: ps
      },
      assigned_dlsa_counsel: repType !== 'Unrepresented' ? {
        name: DLSA_COUNSELS[dlsaIndex],
        bar_reg_no: `D/${3000 + dlsaIndex}/2015`,
        phone: `+91 9871${(10000 + dlsaIndex).toString().slice(1)}`,
        assigned_date: remandDateStr,
        counsel_type: 'DLSA Legal Aid'
      } : null,
      assigned_court_clerk: 'Sh. P.K. Sharma (Court Master)',
      case_diary_status: chargesheetStatus === 'Filed'
        ? 'Chargesheet submitted to Court. Prosecution evidence scheduled.'
        : 'Investigation active. Case diary extracts verified by Station IO.',
      notification_history: [
        {
          id: `notif-${i}-1`,
          timestamp: new Date(today.getTime() - (i % 5) * 3600000).toISOString(),
          recipient_role: 'JUDGE',
          recipient_name: "Hon'ble Sh. Vikram Adhiraj",
          channel: 'eCourts_Portal',
          subject: `Status Update: ${compliance.milestone} for ${accusedName}`,
          status: 'DELIVERED'
        }
      ],
      compliance: {
        status: compliance.status,
        milestone: compliance.milestone,
        statutory_ref: compliance.statutory_ref,
        reason: compliance.reason,
        milestone_date: today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      }
    });
  }

  return result;
}

/**
 * Exports any dataset of Cases to clean, standards-compliant CSV for High Court & CIS audits
 */
export function exportCasesToCSV(cases: Case[]): string {
  const headers = [
    'Case ID',
    'Docket No',
    'FIR No',
    'Police Station',
    'Accused Name',
    'UTP Number',
    'Offence & Section',
    'Custody Days',
    'Max Sentence Days',
    'Custody %',
    'First Time Offender',
    'Chargesheet Status',
    'Remand Date',
    'Representation Status',
    'Compliance Status',
    'Statutory Milestone',
    'Statutory Reference',
    'Assigned IO',
    'Assigned DLSA Counsel'
  ];

  const rows = cases.map(c => {
    const pct = Math.round((c.custody_days / c.maximum_sentence_days) * 100);
    return [
      `"${c.case_id}"`,
      `"${c.docket_no || ''}"`,
      `"${c.fir_no || ''}"`,
      `"${c.police_station || ''}"`,
      `"${c.accused_name}"`,
      `"${c.utp_number || ''}"`,
      `"${c.offence_section.replace(/"/g, '""')}"`,
      c.custody_days,
      c.maximum_sentence_days,
      `${pct}%`,
      c.first_time_offender ? 'YES' : 'NO',
      `"${c.chargesheet_status}"`,
      `"${c.remand_date}"`,
      `"${c.representation_status || 'Unassigned'}"`,
      `"${c.compliance.status}"`,
      `"${c.compliance.milestone || ''}"`,
      `"${c.compliance.statutory_ref || ''}"`,
      `"${c.assigned_io?.name || ''}"`,
      `"${c.assigned_dlsa_counsel?.name || 'Unrepresented'}"`
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Parses user-uploaded JSON or CSV content into validated Case array
 */
export function parseCustomDataset(content: string, fileName: string): Case[] {
  if (fileName.endsWith('.json') || content.trim().startsWith('[') || content.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(content);
      const arr = Array.isArray(parsed) ? parsed : (parsed.cases || parsed.data || [parsed]);
      return arr.map((item: any, idx: number): Case => {
        // Calculate custody days from remand_date if custody_days not explicitly provided
        let custody = Number(item.custody_days || item.custodyDays || 0);
        const remandStr = item.remand_date || item.remandDate || '2026-01-01';
        
        if (!custody && remandStr) {
          const remandTime = new Date(remandStr).getTime();
          if (!isNaN(remandTime)) {
            // Reference time: August 2026 (current time)
            const currentTime = new Date('2026-08-29').getTime();
            custody = Math.max(1, Math.floor((currentTime - remandTime) / (1000 * 60 * 60 * 24)));
          } else {
            custody = 60;
          }
        }
        if (!custody) custody = 60;

        const maxDays = Number(item.max_sentence_days || item.maximum_sentence_days || item.maxDays || 1095);
        const firstTime = Boolean(
          item.is_first_offender ?? item.first_time_offender ?? item.firstTimeOffender ?? true
        );
        
        // Handle chargesheet_filed boolean or chargesheet_status string
        let csStatus = 'Filed';
        if (item.chargesheet_filed === false || item.chargesheet_status === 'Pending' || item.chargesheet_status?.includes('Pending')) {
          csStatus = 'Pending (Default Bail Accrued)';
        } else if (item.chargesheet_status) {
          csStatus = item.chargesheet_status;
        }

        const offences = item.sections || item.offence_section || item.offenceSection || 'Sec 379 IPC';
        const courtName = item.court_name || item.courtName || "Court of Judicial Magistrate - III, Tirunelveli";
        const jailLoc = item.jail_location || item.jailLocation || "Central Prison, Palayamkottai";
        const dlsaUnit = item.dlsa_unit || item.dlsaUnit || "DLSA Tirunelveli";
        const hasCounsel = item.has_counsel ?? (item.representation_status ? item.representation_status !== 'Unrepresented' : true);
        const cnr = item.cnr_number || item.cnrNumber || `TNTL060410${2023 + idx}`;
        const judgeHierarchy = item.judge_hierarchy || item.judgeHierarchy || (courtName.includes('- I') ? 'jm-I' : courtName.includes('- II') ? 'jm-II' : courtName.includes('Chief') || courtName.includes('CJM') ? 'cjm' : 'jm-III');

        const compliance = item.compliance?.status 
          ? item.compliance 
          : computeStatutoryCompliance(custody, maxDays, firstTime, csStatus, custody);

        return {
          case_id: item.case_id || item.caseId || `CC/0410/${2023 + idx}`,
          cnr_number: cnr,
          court_name: courtName,
          jail_location: jailLoc,
          docket_no: item.case_id || item.docket_no || `CC/0410/${2023 + idx}`,
          fir_no: item.police_station?.match(/FIR No\.?\s*([^)]+)/i)?.[1] ? `FIR ${item.police_station.match(/FIR No\.?\s*([^)]+)/i)?.[1]}` : (item.fir_no || `FIR ${idx + 1}/2023`),
          police_station: item.police_station || 'Tirunelveli Town P.S',
          accused_name: item.accused_name || item.accusedName || `Undertrial ${idx + 1}`,
          utp_number: item.utp_number || item.utpNumber || `UTP-PALAYAM-${String(idx + 1).padStart(4, '0')}`,
          offence_section: offences,
          sections: offences,
          remand_date: remandStr,
          chargesheet_date: item.chargesheet_date || (csStatus === 'Filed' ? '15 Aug 2023' : null),
          chargesheet_status: csStatus,
          chargesheet_filed: csStatus === 'Filed',
          maximum_sentence_days: maxDays,
          max_sentence_days: maxDays,
          custody_days: custody,
          first_time_offender: firstTime,
          is_first_offender: firstTime,
          has_counsel: hasCounsel,
          dlsa_unit: dlsaUnit,
          judge_hierarchy: judgeHierarchy,
          representation_status: hasCounsel ? (item.representation_status || 'DLSA Appointed') : 'Unrepresented',
          assigned_judge: item.assigned_judge || `Hon'ble Magistrate (${courtName.replace('Court of ', '')})`,
          assigned_io: item.assigned_io || {
            name: 'Insp. M. Shanmugam',
            badge_no: 'TN-POL-IO-4109',
            phone: '+91 94432 10410',
            police_station: item.police_station || 'Tirunelveli Town P.S'
          },
          assigned_dlsa_counsel: hasCounsel ? (item.assigned_dlsa_counsel || {
            name: 'Adv. S. Ramasubramanian',
            bar_reg_no: 'MS/1842/2014',
            phone: '+91 98421 55678',
            assigned_date: remandStr,
            counsel_type: 'DLSA Legal Aid'
          }) : null,
          assigned_court_clerk: item.assigned_court_clerk || 'Thiru. K. Arumugam (Head Clerk)',
          case_diary_status: csStatus === 'Filed' ? 'Chargesheet submitted to Magistrate.' : 'Investigation ongoing. Sec 187/167 remand limit exceeded.',
          compliance: compliance,
          notification_history: item.notification_history || []
        };
      });
    } catch (e) {
      throw new Error(`JSON parsing failed: ${(e as Error).message}`);
    }
  }

  // Basic CSV Parser
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) {
    throw new Error('CSV file is empty or does not contain data rows.');
  }

  const result: Case[] = [];
  for (let i = 1; i < lines.length; i++) {
    // Simple CSV row regex parsing quoted commas
    const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
    const cleanRow = row.map(cell => cell.replace(/^"|"$/g, '').trim());

    if (cleanRow.length >= 2) {
      const caseId = cleanRow[0] || `C-CSV-${i}`;
      const docketNo = cleanRow[1] || `CC/CSV/${i}/2026`;
      const firNo = cleanRow[2] || `FIR ${i}/2026`;
      const ps = cleanRow[3] || 'PS Central';
      const accused = cleanRow[4] || `Undertrial ${i}`;
      const utp = cleanRow[5] || `UTP-CSV-${i}`;
      const offence = cleanRow[6] || 'Sec 379 IPC';
      const custodyDays = parseInt(cleanRow[7] || '60', 10) || 60;
      const maxDays = parseInt(cleanRow[8] || '1095', 10) || 1095;
      const firstOffender = (cleanRow[9] || '').toUpperCase() === 'YES' || (cleanRow[9] || '').toUpperCase() === 'TRUE';
      const csStatus = cleanRow[10] || 'Filed';
      const remandDate = cleanRow[11] || '01 Jan 2026';
      const repStatus = (cleanRow[12] || 'DLSA Appointed') as any;

      const compliance = computeStatutoryCompliance(custodyDays, maxDays, firstOffender, csStatus, custodyDays);

      result.push({
        case_id: caseId,
        docket_no: docketNo,
        fir_no: firNo,
        police_station: ps,
        accused_name: accused,
        utp_number: utp,
        offence_section: offence,
        remand_date: remandDate,
        chargesheet_status: csStatus,
        maximum_sentence_days: maxDays,
        custody_days: custodyDays,
        first_time_offender: firstOffender,
        representation_status: repStatus,
        assigned_judge: "Hon'ble Magistrate (MM-04)",
        assigned_io: {
          name: cleanRow[16] || 'Insp. R.K. Meena',
          badge_no: 'DL-POL-IO-8891',
          phone: '+91 98101 23456',
          police_station: ps
        },
        assigned_dlsa_counsel: {
          name: cleanRow[17] || 'Adv. Meenakshi Sundaram',
          bar_reg_no: 'D/4092/2012',
          phone: '+91 98712 34567',
          assigned_date: remandDate,
          counsel_type: 'DLSA Legal Aid'
        },
        assigned_court_clerk: 'Sh. P.K. Sharma (Court Master)',
        case_diary_status: 'CSV Imported docket row.',
        compliance: compliance,
        notification_history: []
      });
    }
  }

  return result;
}
