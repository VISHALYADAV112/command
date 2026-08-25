import { McpServer, type CallToolResult } from '@modelcontextprotocol/server'
import { z } from 'zod'
import type { CaptureInput, CommandRepository } from './types.ts'

const empty = z.object({})
const projectStatus = z.enum(['active', 'blocked', 'review', 'done']).optional()
const jobStatus = z.enum(['researching', 'applied', 'oa', 'phone', 'onsite', 'offer', 'rejected']).optional()
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const capture = z.object({
  kind: z.enum(['idea', 'learning', 'project', 'person', 'application']),
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(200).optional(),
  content: z.string().trim().max(5000).optional(),
  nextAction: z.string().trim().max(500).optional(),
  dueOn: date.optional(),
  track: z.enum(['node', 'dsa', 'math']).optional(),
  sourceUrl: z.string().url().max(1000).optional(),
  idempotencyKey: z.string().trim().min(8).max(200),
}).superRefine((value, ctx) => {
  if ((value.kind === 'project' || value.kind === 'application') && !value.nextAction) {
    ctx.addIssue({ code: 'custom', path: ['nextAction'], message: 'Active work requires a next action.' })
  }
  if (value.kind === 'application' && !value.subtitle) {
    ctx.addIssue({ code: 'custom', path: ['subtitle'], message: 'Applications require the role in subtitle.' })
  }
})

export function createCommandServer(repository: CommandRepository): McpServer {
  const server = new McpServer({ name: 'command', version: '0.1.0' })

  server.registerTool('command_get_today', {
    title: 'Get Command today', description: 'Read today’s log, active work, follow-ups, and due learning.', inputSchema: empty,
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, () => run(repository, 'command_get_today', {}, () => repository.getToday()))

  server.registerTool('command_get_week', {
    title: 'Get Command week', description: 'Read the current Monday–Sunday activity and commitments.', inputSchema: empty,
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, () => run(repository, 'command_get_week', {}, () => repository.getWeek()))

  server.registerTool('command_search', {
    title: 'Search Command', description: 'Search learning, people, applications, projects, ideas, and daily notes.',
    inputSchema: z.object({ query: z.string().trim().min(2).max(100), limit: z.number().int().min(1).max(50).default(20) }),
    annotations: { readOnlyHint: true, idempotentHint: true },
  }, ({ query, limit }) => run(repository, 'command_search', { queryLength: query.length }, () => repository.search(query, limit)))

  server.registerTool('command_list_projects', {
    title: 'List Command projects', description: 'List projects, optionally filtered by status.',
    inputSchema: z.object({ status: projectStatus }), annotations: { readOnlyHint: true, idempotentHint: true },
  }, ({ status }) => run(repository, 'command_list_projects', { status }, () => repository.listProjects(status)))

  server.registerTool('command_list_jobs', {
    title: 'List Command applications', description: 'List job applications, optionally filtered by pipeline status.',
    inputSchema: z.object({ status: jobStatus }), annotations: { readOnlyHint: true, idempotentHint: true },
  }, ({ status }) => run(repository, 'command_list_jobs', { status }, () => repository.listJobs(status)))

  server.registerTool('command_get_learning_due', {
    title: 'Get learning due', description: 'List learning items due for recall on or before a date.',
    inputSchema: z.object({ asOf: date.optional() }), annotations: { readOnlyHint: true, idempotentHint: true },
  }, ({ asOf }) => run(repository, 'command_get_learning_due', { asOf }, () => repository.getLearningDue(asOf)))

  server.registerTool('command_capture', {
    title: 'Capture into Command',
    description: 'Idempotently capture an idea, learning item, project, person, or job application. For applications, title is company and subtitle is role.',
    inputSchema: capture,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  }, (input) => run(repository, 'command_capture', { kind: input.kind }, () => repository.capture(input as CaptureInput)))

  server.registerResource('command-today', 'command://today', {
    title: 'Command today', description: 'Today’s current operating context', mimeType: 'application/json',
  }, async (uri) => resource(uri, await repository.getToday()))

  server.registerResource('command-week', 'command://week', {
    title: 'Command week', description: 'The current Monday–Sunday context', mimeType: 'application/json',
  }, async (uri) => resource(uri, await repository.getWeek()))

  return server
}

async function run(
  repository: CommandRepository,
  tool: string,
  summary: Record<string, unknown>,
  operation: () => Promise<Record<string, unknown>>,
): Promise<CallToolResult> {
  const started = performance.now()
  try {
    const output = await operation()
    await repository.audit({ tool, summary, success: true, durationMs: performance.now() - started })
    return { content: [{ type: 'text', text: JSON.stringify(output) }], structuredContent: output }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Command operation failed.'
    await repository.audit({ tool, summary, success: false, error: message, durationMs: performance.now() - started })
    return { content: [{ type: 'text', text: message.slice(0, 300) }], isError: true }
  }
}

function resource(uri: URL, data: Record<string, unknown>) {
  return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(data) }] }
}
