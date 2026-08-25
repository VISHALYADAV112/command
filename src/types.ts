export type PracticeKey = 'node' | 'dsa' | 'math' | 'job'
export type Diet = 'on_track' | 'loose' | 'off' | null

export interface DailyLog {
  day: string
  meditation: boolean
  gym: boolean
  diet: Diet
  nodeMinutes: number
  dsaMinutes: number
  mathMinutes: number
  jobMinutes: number
  note: string
}

export interface Settings {
  floors: Record<PracticeKey, number>
  budgets: Record<PracticeKey, number>
}

export type ApplicationStatus =
  | 'researching'
  | 'applied'
  | 'oa'
  | 'phone'
  | 'onsite'
  | 'offer'
  | 'rejected'

export type ApplicationChannel = 'india_product' | 'gcc' | 'remote_intl' | 'services'

export interface JobApplication {
  id: string
  company: string
  role: string
  lane: 'sde' | 'ai_ml'
  channel: ApplicationChannel
  status: ApplicationStatus
  windowClosesOn: string | null
  appliedOn: string | null
  followUpOn: string | null
  hasReferral: boolean
  ctcLpa: number | null
  referrerId: string | null
  jobUrl: string
  resumeVersion: string
  resumeDriveUrl: string
  nextAction: string
  notes: string
}

export interface Person {
  id: string
  name: string
  company: string
  email: string
  linkedinUrl: string
  howKnown: 'cold' | 'alumni' | 'linkedin' | 'ex_colleague' | 'referred_by' | null
  status: 'to_reach_out' | 'talking' | 'referred' | 'cold'
  lastContactOn: string | null
  nextFollowUpOn: string | null
  notes: string
}

export interface Project {
  id: string
  name: string
  type: 'internship' | 'freelance' | 'portfolio'
  status: 'active' | 'blocked' | 'review' | 'done'
  client: string
  paymentStatus: 'na' | 'unpaid' | 'invoiced' | 'paid'
  amount: number | null
  currency: string
  isPublic: boolean
  deadlineOn: string | null
  repoUrl: string
  demoUrl: string
  driveFolderUrl: string
  nextAction: string
  content: string
}

export interface LearningItem {
  id: string
  concept: string
  stack: 'job' | 'brain'
  track: 'node' | 'dsa' | 'math'
  itemType: 'concept' | 'pattern' | 'snippet' | 'formula'
  confidence: 1 | 2 | 3 | 4 | 5
  difficulty: 'easy' | 'medium' | 'hard' | null
  nextReviewOn: string | null
  lastReviewedOn: string | null
  masteryHits: number
  sourceUrl: string
  content: string
}

export type Recall = 'instant' | 'effort' | 'struggled' | 'blank'

export type IdeaStatus = 'captured' | 'exploring' | 'validating' | 'dropped'

export interface Idea {
  id: string
  idea: string
  problem: string
  targetMarket: string
  monetization: string
  status: IdeaStatus
  nextAction: string
}

export interface CommandData {
  logs: DailyLog[]
  applications: JobApplication[]
  people: Person[]
  projects: Project[]
  learning: LearningItem[]
  ideas: Idea[]
}
