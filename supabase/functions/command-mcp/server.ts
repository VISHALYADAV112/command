import { McpServer, type CallToolResult } from '@modelcontextprotocol/server'
import { z } from 'zod'
import type { CaptureInput, CommandRepository, CompleteInput, QueryInput, ScheduleInput } from './types.ts'
import { publicErrorMessage } from './errors.ts'
import { MCP_PERMISSION } from './permissions.ts'
import { validDate } from './validation.ts'

const empty = z.object({})
const date = z.string().refine(validDate, 'Use a real date in YYYY-MM-DD format.')
const fieldValue = z.union([
  z.string().max(10_000), z.number().finite(), z.boolean(), z.null(),
])
const capture = z.object({
  typeKey: z.string().trim().regex(/^[a-z][a-z0-9_]{0,62}$/),
  title: z.string().trim().min(1).max(200),
  fields: z.record(z.string().regex(/^[a-z][a-z0-9_]{0,62}$/), fieldValue)
    .refine((fields) => Object.keys(fields).length <= 50, 'At most 50 fields are allowed.')
    .refine((fields) => new TextEncoder().encode(JSON.stringify(fields)).byteLength <= 65_536, 'Fields are too large.'),
  schemaVersion: z.number().int().positive().max(1000),
  idempotencyKey: z.string().trim().min(8).max(200),
})
const complete = z.object({
  entityId: z.string().uuid(), commitmentId: z.string().uuid(),
  outcome: z.string().trim().min(1).max(5000), idempotencyKey: z.string().trim().min(8).max(200),
})
const schedule = z.object({
  entityId: z.string().uuid(), kind: z.string().trim().min(1).max(80),
  action: z.string().trim().min(1).max(500), dueOn: date,
  idempotencyKey: z.string().trim().min(8).max(200),
})
const query = z.object({
  typeKey: z.string().trim().regex(/^[a-z][a-z0-9_]{0,62}$/).optional(),
  dueWindow: z.enum(['overdue', 'today', 'week', 'all']).optional(),
  text: z.string().trim().min(2).max(100).optional(),
  limit: z.number().int().min(1).max(20).default(20),
}).refine((value) => value.typeKey || value.dueWindow || value.text, {
  message: 'Provide a type, due window, or text filter.',
}).refine((value) => !(value.dueWindow && value.text), {
  message: 'Use either a due window or text search, not both.',
})

export function createCommandServer(repository: CommandRepository): McpServer {
  const server = new McpServer({ name: 'command', version: '0.1.0' })

  server.registerTool('command_describe_types', {
    title: 'Describe Command types', description: 'Discover active types, current field schemas, and allowed commitment kinds.', inputSchema: empty,
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, () => run(repository, MCP_PERMISSION.typesRead, 'command_describe_types', {}, () => repository.describeTypes()))

  server.registerTool('command_capture', {
    title: 'Capture into Command',
    description: 'Create a schema-validated pending proposal for a record of a discovered type.',
    inputSchema: capture,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, (input) => run(repository, MCP_PERMISSION.proposalsWrite, 'command_capture', { typeKey: input.typeKey }, () => repository.capture(input as CaptureInput)))

  server.registerTool('command_complete', {
    title: 'Complete a Command commitment', description: 'Create a pending proposal to record a commitment outcome.',
    inputSchema: complete, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, (input) => run(repository, MCP_PERMISSION.proposalsWrite, 'command_complete', {}, () => repository.complete(input as CompleteInput)))

  server.registerTool('command_schedule', {
    title: 'Schedule a Command commitment', description: 'Create a pending proposal for a permitted commitment kind.',
    inputSchema: schedule, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, (input) => run(repository, MCP_PERMISSION.proposalsWrite, 'command_schedule', {}, () => repository.schedule(input as ScheduleInput)))

  server.registerTool('command_query', {
    title: 'Query Command', description: 'Read a bounded set of records or open commitments using a type, due-window, or text filter.',
    inputSchema: query, annotations: { readOnlyHint: true, idempotentHint: true },
  }, (input) => run(repository, MCP_PERMISSION.dataRead, 'command_query', { typeKey: input.typeKey, dueWindow: input.dueWindow, hasText: Boolean(input.text) }, () => repository.query(input as QueryInput)))

  return server
}

async function run(
  repository: CommandRepository,
  requiredPermission: string,
  tool: string,
  summary: Record<string, unknown>,
  operation: () => Promise<Record<string, unknown>>,
): Promise<CallToolResult> {
  const started = performance.now()
  try {
    await repository.authorize(requiredPermission)
    const output = await operation()
    await repository.audit({ tool, summary, success: true, durationMs: performance.now() - started })
    return { content: [{ type: 'text', text: JSON.stringify(output) }], structuredContent: output }
  } catch (error) {
    const message = publicErrorMessage(error)
    await repository.audit({ tool, summary, success: false, error: message, durationMs: performance.now() - started })
    return { content: [{ type: 'text', text: message.slice(0, 300) }], isError: true }
  }
}
