export interface CaptureInput {
  typeKey: string
  title: string
  fields: Record<string, unknown>
  schemaVersion: number
  idempotencyKey: string
}

export interface CompleteInput {
  entityId: string
  commitmentId: string
  outcome: string
  idempotencyKey: string
}

export interface ScheduleInput {
  entityId: string
  kind: string
  action: string
  dueOn: string
  idempotencyKey: string
}

export interface QueryInput {
  typeKey?: string
  dueWindow?: 'overdue' | 'today' | 'week' | 'all'
  text?: string
  limit: number
}

export interface AuditEntry {
  tool: string
  summary: Record<string, unknown>
  success: boolean
  error?: string
  durationMs: number
}

export interface CommandRepository {
  authorize(permission: string): Promise<void>
  describeTypes(): Promise<Record<string, unknown>>
  capture(input: CaptureInput): Promise<Record<string, unknown>>
  complete(input: CompleteInput): Promise<Record<string, unknown>>
  schedule(input: ScheduleInput): Promise<Record<string, unknown>>
  query(input: QueryInput): Promise<Record<string, unknown>>
  audit(entry: AuditEntry): Promise<void>
}
