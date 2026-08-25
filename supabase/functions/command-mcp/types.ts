export type CaptureKind = 'idea' | 'learning' | 'project' | 'person' | 'application'

export interface CaptureInput {
  kind: CaptureKind
  title: string
  subtitle?: string
  content?: string
  nextAction?: string
  dueOn?: string
  track?: 'node' | 'dsa' | 'math'
  sourceUrl?: string
  idempotencyKey: string
}

export interface AuditEntry {
  tool: string
  summary: Record<string, unknown>
  success: boolean
  error?: string
  durationMs: number
}

export interface CommandRepository {
  getToday(): Promise<Record<string, unknown>>
  getWeek(): Promise<Record<string, unknown>>
  search(query: string, limit: number): Promise<Record<string, unknown>>
  listProjects(status?: string): Promise<Record<string, unknown>>
  listJobs(status?: string): Promise<Record<string, unknown>>
  getLearningDue(asOf?: string): Promise<Record<string, unknown>>
  capture(input: CaptureInput): Promise<Record<string, unknown>>
  audit(entry: AuditEntry): Promise<void>
}
