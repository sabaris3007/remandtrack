import { UserProfile, UserRole, AuthSession, JudgeHierarchyCode } from '../types/auth';

/**
 * 4 Permanent Institutional Hierarchy Judge Accounts
 * Constant usernames / identifiers for judicial benches (invariant across judicial transfers and rotations)
 */
export const HIERARCHY_JUDGE_LOGINS: Record<JudgeHierarchyCode, UserProfile> = {
  'jm-I': {
    id: 'bench-jm-1',
    name: 'Court of Judicial Magistrate - I',
    role: 'JUDGE',
    designation: 'Judicial Magistrate - I (JM-I)',
    department: 'District Judicial Services • Bench 1',
    badge_or_id: 'JM-I',
    email: 'jm1.court@ecourts.gov.in',
    avatar_initials: 'J1',
    court_room: 'Courtroom No. 1, Judicial District Complex',
    judge_hierarchy: 'jm-I',
  },
  'jm-II': {
    id: 'bench-jm-2',
    name: 'Court of Judicial Magistrate - II',
    role: 'JUDGE',
    designation: 'Judicial Magistrate - II (JM-II)',
    department: 'District Judicial Services • Bench 2',
    badge_or_id: 'JM-II',
    email: 'jm2.court@ecourts.gov.in',
    avatar_initials: 'J2',
    court_room: 'Courtroom No. 2, Judicial District Complex',
    judge_hierarchy: 'jm-II',
  },
  'jm-III': {
    id: 'bench-jm-3',
    name: 'Court of Judicial Magistrate - III',
    role: 'JUDGE',
    designation: 'Judicial Magistrate - III (JM-III)',
    department: 'Court of Judicial Magistrate - III, Tirunelveli',
    badge_or_id: 'JM-III',
    email: 'jm3.court@ecourts.gov.in',
    avatar_initials: 'J3',
    court_room: 'Courtroom No. 3, Combined Court Buildings, Tirunelveli',
    judge_hierarchy: 'jm-III',
  },
  'cjm': {
    id: 'bench-cjm',
    name: 'Court of Chief Judicial Magistrate',
    role: 'JUDGE',
    designation: 'Chief Judicial Magistrate (CJM)',
    department: 'District & Sessions Magistracy • Principal Bench',
    badge_or_id: 'CJM',
    email: 'cjm.court@ecourts.gov.in',
    avatar_initials: 'CJ',
    court_room: 'Courtroom No. 1 (Chief Judicial Magistrate)',
    judge_hierarchy: 'cjm',
  },
};

/**
 * Dormant Personas for other roles (retained for future milestone expansion)
 */
export const MOCK_PERSONAS: Record<UserRole, UserProfile> = {
  JUDGE: HIERARCHY_JUDGE_LOGINS['jm-III'], // Default MVP judge bench
  INVESTIGATING_OFFICER: {
    id: 'usr-io-02',
    name: 'Insp. M. Shanmugam',
    role: 'INVESTIGATING_OFFICER',
    designation: 'Station House Officer / Investigating Officer',
    department: 'Tirunelveli Police Division',
    badge_or_id: 'TN-POL-IO-4109',
    email: 'sho.tirunelveli@police.tn.gov.in',
    avatar_initials: 'MS',
    jurisdiction_stations: ['Tirunelveli Town P.S', 'Palayamkottai P.S', 'Melapalayam P.S'],
  },
  DLSA_OFFICER: {
    id: 'usr-dlsa-03',
    name: 'Adv. S. Ramasubramanian',
    role: 'DLSA_OFFICER',
    designation: 'Legal Aid Defense Counsel (LADC) / Secretary',
    department: 'District Legal Services Authority, Tirunelveli',
    badge_or_id: 'DLSA-TIR-409/2021',
    email: 'ladc.tirunelveli@dlsa.tn.gov.in',
    avatar_initials: 'SR',
  },
  PRISON_AUTHORITY: {
    id: 'usr-prison-05',
    name: 'Thiru. V. Soundararajan',
    role: 'PRISON_AUTHORITY',
    designation: 'Jail Superintendent / Custody Officer',
    department: 'Central Prison, Palayamkottai • Custody Records',
    badge_or_id: 'TN-PRISONS-SUPT-108',
    email: 'supt.palayamkottai@prisons.tn.gov.in',
    avatar_initials: 'VS',
    court_room: 'Central Prison Records Wing',
  },
  REGISTRY_CLERK: {
    id: 'usr-clerk-04',
    name: 'Thiru. K. Arumugam',
    role: 'REGISTRY_CLERK',
    designation: 'Court Master & Head Clerk',
    department: 'Subordinate Judiciary Registry & CIS Administration',
    badge_or_id: 'TN-HC-REG-3041',
    email: 'courtmaster.jm3@districts.ecourts.gov.in',
    avatar_initials: 'KA',
    court_room: 'Registry Hall, Tirunelveli Court Complex',
  },
};

const AUTH_STORAGE_KEY = 'remindtrack_auth_session';

export function getActiveSession(): AuthSession | null {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as AuthSession;
  } catch {
    return null;
  }
}

export function saveSession(user: UserProfile): AuthSession {
  const session: AuthSession = {
    user,
    token: `jwt-judicial-${user.judge_hierarchy || user.role.toLowerCase()}-${Date.now()}`,
    login_time: new Date().toISOString(),
  };
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function clearSession(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function loginWithHierarchyJudge(code: JudgeHierarchyCode): Promise<AuthSession> {
  await new Promise(resolve => setTimeout(resolve, 200));
  const user = HIERARCHY_JUDGE_LOGINS[code] || HIERARCHY_JUDGE_LOGINS['jm-III'];
  return saveSession(user);
}

export async function loginWithPersona(role: UserRole): Promise<AuthSession> {
  await new Promise(resolve => setTimeout(resolve, 200));
  const user = MOCK_PERSONAS[role];
  return saveSession(user);
}

export function resolveHierarchyKey(input: string): JudgeHierarchyCode | null {
  const clean = input.trim().toLowerCase().replace(/[_\s.]+/g, '-');
  if (clean.includes('jm-3') || clean.includes('jm3') || clean.includes('jm-iii') || clean.includes('jmiii') || clean.includes('magistrate-3') || clean.includes('magistrate-iii')) {
    return 'jm-III';
  }
  if (clean.includes('jm-1') || clean.includes('jm1') || clean.includes('jm-i') || clean.includes('jmi') || clean.includes('magistrate-1') || clean.includes('magistrate-i')) {
    return 'jm-I';
  }
  if (clean.includes('jm-2') || clean.includes('jm2') || clean.includes('jm-ii') || clean.includes('jmii') || clean.includes('magistrate-2') || clean.includes('magistrate-ii')) {
    return 'jm-II';
  }
  if (clean.includes('cjm') || clean.includes('chief')) {
    return 'cjm';
  }
  return null;
}

export function resolveStakeholderRole(input: string): UserRole | null {
  const clean = input.trim().toLowerCase().replace(/[_\s.]+/g, '-');
  if (clean.includes('io') || clean.includes('police') || clean.includes('shanmugam') || clean.includes('sho')) {
    return 'INVESTIGATING_OFFICER';
  }
  if (clean.includes('dlsa') || clean.includes('counsel') || clean.includes('ramasubramanian') || clean.includes('ladc') || clean.includes('aid')) {
    return 'DLSA_OFFICER';
  }
  if (clean.includes('prison') || clean.includes('jail') || clean.includes('supt') || clean.includes('soundararajan')) {
    return 'PRISON_AUTHORITY';
  }
  if (clean.includes('registry') || clean.includes('clerk') || clean.includes('arumugam') || clean.includes('courtmaster')) {
    return 'REGISTRY_CLERK';
  }
  return null;
}

export async function loginWithCredentials(
  emailOrId: string,
  password: string,
  selectedRole: UserRole = 'JUDGE'
): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
  await new Promise(resolve => setTimeout(resolve, 200));

  if (!emailOrId.trim() || !password.trim()) {
    return { success: false, error: 'Please enter your Username / Identifier and Password.' };
  }

  // 1. Check if credentials match any of the 4 constant hierarchy judge usernames
  const matchedHierarchy = resolveHierarchyKey(emailOrId);
  if (matchedHierarchy && HIERARCHY_JUDGE_LOGINS[matchedHierarchy]) {
    const user = HIERARCHY_JUDGE_LOGINS[matchedHierarchy];
    const session = saveSession(user);
    return { success: true, session };
  }

  // 2. Check if credentials match institutional stakeholder roles (IO, DLSA, Registry)
  const matchedRole = resolveStakeholderRole(emailOrId);
  if (matchedRole && MOCK_PERSONAS[matchedRole]) {
    const user = MOCK_PERSONAS[matchedRole];
    const session = saveSession(user);
    return { success: true, session };
  }

  // Fallback for custom entry
  const basePersona = MOCK_PERSONAS[selectedRole] || MOCK_PERSONAS.JUDGE;
  const user: UserProfile = {
    ...basePersona,
    email: emailOrId.includes('@') ? emailOrId : `${emailOrId.toLowerCase()}@ecourts.gov.in`,
    badge_or_id: emailOrId.toUpperCase(),
  };

  const session = saveSession(user);
  return { success: true, session };
}
