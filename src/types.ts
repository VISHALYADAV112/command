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

export interface JobApplication {
  id: string
  company: string
  role: string
  lane: 'sde' | 'ai_ml'
  status: ApplicationStatus
  windowClosesOn: string | null
  followUpOn: string | null
  nextAction: string
}

export interface Person {
  id: string
  name: string
  company: string
  status: 'to_reach_out' | 'talking' | 'referred' | 'cold'
  nextFollowUpOn: string | null
}

export interface Project {
  id: string
  name: string
  type: 'internship' | 'freelance' | 'portfolio'
  status: 'active' | 'blocked' | 'review' | 'done'
  deadlineOn: string | null
  nextAction: string
}

export interface LearningItem {
  id: string
  concept: string
  track: 'node' | 'dsa' | 'math'
  itemType: 'concept' | 'pattern' | 'snippet' | 'formula'
  confidence: 1 | 2 | 3 | 4 | 5
  nextReviewOn: string | null
  masteryHits: number
  content: string
}

export interface CommandData {
  logs: DailyLog[]
  applications: JobApplication[]
  people: Person[]
  projects: Project[]
  learning: LearningItem[]
}
