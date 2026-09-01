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
  theme: 'day' | 'night'
  floors: Record<PracticeKey, number>
  budgets: Record<PracticeKey, number>
  weeklyTargets: {
    applications: number
    peopleContacted: number
  }
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

export type EntityFieldKind = 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'url' | 'single_select'
export type CommitmentKind = 'follow-up' | 'deadline' | 'review' | 'contact' | 'drill' | 'milestone'
export type BehaviourPluginKey = 'spaced_repetition'

export interface EntityFieldDefinition {
  key: string
  label: string
  kind: EntityFieldKind
  required: boolean
  listVisible: boolean
  filterable: boolean
  deprecated: boolean
  options: string[]
}

export interface EntityType {
  id: string
  typeKey: string
  singularName: string
  pluralName: string
  iconKey: 'application' | 'person' | 'project' | 'learning' | 'note' | 'generic'
  schemaVersion: number
  fields: EntityFieldDefinition[]
  defaultSortField: string
  defaultSortDirection: 'asc' | 'desc'
  groupByField: string | null
  allowedCommitmentKinds: CommitmentKind[]
  pluginKey: BehaviourPluginKey | null
  isActive: boolean
}

export type EntityFieldValue = string | number | boolean | null

export interface Entity {
  id: string
  entityTypeId: string
  title: string
  fields: Record<string, EntityFieldValue>
  schemaVersion: number
  archivedAt: string | null
}

export type CommitmentState = 'open' | 'completed' | 'cancelled'
export type MutationSource = 'ui' | 'mcp' | 'calendar' | 'migration'

export interface Commitment {
  id: string
  entityId: string
  kind: CommitmentKind
  action: string
  dueOn: string
  state: CommitmentState
  outcome: string | null
  completedAt: string | null
  originSource: MutationSource
}

export interface ActivityEvent {
  id: string
  entityId: string | null
  commitmentId: string | null
  eventType: string
  payload: Record<string, unknown>
  source: MutationSource
  clientId: string | null
  idempotencyKey: string | null
  occurredAt: string
  createdAt: string
}

export type AgentProposalOperation =
  | 'capture'
  | 'update_entity'
  | 'archive_entity'
  | 'schedule'
  | 'complete'
  | 'cancel'
export type AgentProposalState = 'pending' | 'approved' | 'rejected' | 'expired'

export interface AgentProposal {
  id: string
  clientId: string
  operation: AgentProposalOperation
  entityTypeId: string
  targetEntityId: string | null
  targetCommitmentId: string | null
  targetUpdatedAt: string | null
  proposedEntity: Record<string, unknown> | null
  proposedCommitment: Record<string, unknown> | null
  state: AgentProposalState
  decisionNote: string | null
  resultEntityId: string | null
  resultCommitmentId: string | null
  resultEventId: string | null
  idempotencyKey: string
  expiresAt: string
  decidedAt: string | null
  createdAt: string
}

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

export interface LegacyCommandData {
  logs: DailyLog[]
  applications: JobApplication[]
  people: Person[]
  projects: Project[]
  learning: LearningItem[]
  ideas: Idea[]
}

export interface CommandData {
  version: 3
  entityTypes: EntityType[]
  entities: Entity[]
  commitments: Commitment[]
  activityEvents: ActivityEvent[]
  legacy: LegacyCommandData
}
