import type { GeneratedResumeData, ResumeComment, ScoreReport } from "../../../../packages/shared/src";

export interface UserRecord {
  id: string;
  nickname?: string;
  username: string;
  passwordHash: string;
  createdAt: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  active: boolean;
}

export interface ResumeVersionRecord {
  id: string;
  resumeId: string;
  userId: string;
  markdown: string;
  createdAt: string;
}

export interface ResumeRecord {
  id: string;
  userId: string;
  currentVersionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyRecord {
  id: string;
  userId: string;
  name: string;
  website?: string;
  notes?: string;
  createdAt: string;
}

export interface JobApplicationRecord {
  id: string;
  userId: string;
  companyId: string;
  companyName: string;
  roleTitle: string;
  location?: string;
  description: string;
  recruiterNotes?: string;
  createdAt: string;
}

export interface ExportRecord {
  id: string;
  userId: string;
  generatedResumeId: string;
  format: string;
  createdAt: string;
}

export interface LoginAttemptRecord {
  count: number;
  lockedUntil?: number;
}

export interface AppStore {
  users: Map<string, UserRecord>;
  usernameIndex: Map<string, string>;
  sessions: Map<string, SessionRecord>;
  oauthStates: Map<string, { createdAt: number; redirectTo?: string }>;
  loginAttempts: Map<string, LoginAttemptRecord>;
  resumes: Map<string, ResumeRecord>;
  resumeVersions: Map<string, ResumeVersionRecord>;
  companies: Map<string, CompanyRecord>;
  jobs: Map<string, JobApplicationRecord>;
  generatedResumes: Map<string, GeneratedResumeData>;
  scoreReports: Map<string, ScoreReport>;
  comments: Map<string, ResumeComment[]>;
  exports: Map<string, ExportRecord>;
  aiSettings: Map<string, { apiKey: string; defaultModel: string; models: string[] }>;
}

export function createStore(): AppStore {
  return {
    users: new Map(),
    usernameIndex: new Map(),
    sessions: new Map(),
    oauthStates: new Map(),
    loginAttempts: new Map(),
    resumes: new Map(),
    resumeVersions: new Map(),
    companies: new Map(),
    jobs: new Map(),
    generatedResumes: new Map(),
    scoreReports: new Map(),
    comments: new Map(),
    exports: new Map()
    ,aiSettings: new Map()
  };
}

export const appStore = createStore();
