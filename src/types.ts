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
  followUpOn: string | null
  ctcLpa: number | null
  referrerId: string | null
  jobUrl: string
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

export type IdeaStatus = 'captured' | 'exploring' | 'validating' | 'dropped'

export interface Idea {
  id: string
  idea: string
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
