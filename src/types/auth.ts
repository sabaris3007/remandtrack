export type UserRole = 'JUDGE' | 'INVESTIGATING_OFFICER' | 'DLSA_OFFICER' | 'PRISON_AUTHORITY' | 'REGISTRY_CLERK';

export type JudgeHierarchyCode = 'jm-I' | 'jm-II' | 'jm-III' | 'cjm';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  designation: string;
  department: string;
  badge_or_id: string;
  email: string;
  avatar_initials: string;
  jurisdiction_stations?: string[];
  court_room?: string;
  judge_hierarchy?: JudgeHierarchyCode | string;
}

export interface AuthSession {
  user: UserProfile;
  token: string;
  login_time: string;
}
