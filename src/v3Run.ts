import { dateFromKey, dateKey } from './domain'
import type { CommandData, Entity, RunHistoryPoint, RunMetric, RunSummary } from './types'

const firstRoundStatuses = new Set(['phone', 'onsite', 'offer'])
const mockInterview = /^mock interview(?:$|[-\s:])/i

interface MonthRange { key: string; start: string; end: string }

export function deriveRunSummary(data: CommandData, today: Date): RunSummary {
  const asOfDay = dateKey(today)
  const months = completedMonths(asOfDay)
  const types = new Map(data.entityTypes.map((type) => [type.id, type.typeKey]))
  const entityById = new Map(data.entities.map((entity) => [entity.id, entity]))
  const knownSince = earliestKnownDay(data)
  const historyCoverage = knownSince !== null && knownSince <= months[0].start

  const portfolios = data.entities.filter((entity) => isQualifiedPortfolio(entity, types, asOfDay))
    .map((entity) => timestampDay(entity.updatedAt))
  const patterns = data.entities.filter((entity) => isDsaPattern(entity, types, asOfDay))
  const masteredPatterns = patterns.filter((entity) => isMasteredPattern(entity, asOfDay))
    .map((entity) => String(entity.fields.last_reviewed_on))
  const mocks = data.commitments.filter((commitment) => commitment.state === 'completed'
    && commitment.kind === 'drill' && mockInterview.test(commitment.action)
    && commitment.completedAt && timestampDay(commitment.completedAt) <= asOfDay)
    .map((commitment) => timestampDay(commitment.completedAt!))
  const referrals = firstReferralDates(data, entityById, types, asOfDay)
  const submissions = latestSubmissions(data, entityById, types, asOfDay)
  const converted = submissions.filter(({ entity }) => firstRoundStatuses.has(String(entity.fields.status)))
  const conversionHistory = months.map((month) => {
    const cohort = submissions.filter(({ day }) => day >= month.start && day <= month.end)
    const numerator = cohort.filter(({ entity }) => firstRoundStatuses.has(String(entity.fields.status))).length
    return { month: month.key, value: cohort.length ? percent(numerator, cohort.length) : null }
  })

  return {
    asOfDay,
    historyStart: months[0].start,
    historyEnd: months[2].end,
    publicPortfolio: metric(portfolios.length, 3, cumulativeHistory(portfolios, months), historyCoverage),
    dsaPatterns: {
      ...metric(masteredPatterns.length, 24, cumulativeHistory(masteredPatterns, months), historyCoverage),
      covered: patterns.length,
    },
    mockInterviews: metric(mocks.length, 10, cumulativeHistory(mocks, months), historyCoverage),
    applicationConversion: {
      ...metric(
        submissions.length ? percent(converted.length, submissions.length) : null,
        25,
        conversionHistory,
        historyCoverage && conversionHistory.every((point) => point.value !== null),
      ),
      numerator: converted.length,
      denominator: submissions.length,
    },
    referralConversations: metric(referrals.length, 12, cumulativeHistory(referrals, months), historyCoverage),
  }
}

function completedMonths(asOfDay: string): MonthRange[] {
  const [year, month] = asOfDay.split('-').map(Number)
  return [-3, -2, -1].map((offset) => {
    const start = new Date(Date.UTC(year, month - 1 + offset, 1, 6, 30))
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 6, 30))
    return { key: dateKey(start).slice(0, 7), start: dateKey(start), end: dateKey(end) }
  })
}

function earliestKnownDay(data: CommandData): string | null {
  const days = [
    ...data.entities.map((entity) => timestampDay(entity.createdAt)),
    ...data.activityEvents.map((event) => timestampDay(event.occurredAt)),
  ].sort()
  return days[0] ?? null
}

function isQualifiedPortfolio(entity: Entity, types: Map<string, string>, asOfDay: string): boolean {
  return types.get(entity.entityTypeId) === 'project' && entity.archivedAt === null
    && entity.fields.project_type === 'portfolio' && entity.fields.status === 'done'
    && entity.fields.is_public === true && hasText(entity.fields.content_markdown)
    && (hasText(entity.fields.repo_url) || hasText(entity.fields.demo_url))
    && timestampDay(entity.updatedAt) <= asOfDay
}

function isDsaPattern(entity: Entity, types: Map<string, string>, asOfDay: string): boolean {
  return types.get(entity.entityTypeId) === 'learning' && entity.archivedAt === null
    && entity.fields.track === 'dsa' && entity.fields.item_type === 'pattern'
    && timestampDay(entity.createdAt) <= asOfDay
}

function isMasteredPattern(entity: Entity, asOfDay: string): boolean {
  return entity.fields.confidence === 5 && Number(entity.fields.mastery_hits ?? 0) >= 2
    && typeof entity.fields.last_reviewed_on === 'string' && entity.fields.last_reviewed_on <= asOfDay
}

function firstReferralDates(data: CommandData, entities: Map<string, Entity>, types: Map<string, string>, asOfDay: string): string[] {
  const firsts = new Map<string, string>()
  for (const commitment of data.commitments) {
    const entity = entities.get(commitment.entityId)
    if (!entity || types.get(entity.entityTypeId) !== 'person' || commitment.kind !== 'contact'
      || commitment.state !== 'completed' || !commitment.completedAt) continue
    const day = timestampDay(commitment.completedAt)
    if (day > asOfDay) continue
    const current = firsts.get(entity.id)
    if (!current || day < current) firsts.set(entity.id, day)
  }
  return [...firsts.values()]
}

function latestSubmissions(
  data: CommandData,
  entities: Map<string, Entity>,
  types: Map<string, string>,
  asOfDay: string,
): Array<{ entity: Entity; day: string }> {
  const latest = new Map<string, { entity: Entity; day: string; createdAt: string; eventId: string }>()
  for (const event of data.activityEvents) {
    const entity = event.entityId ? entities.get(event.entityId) : undefined
    const day = timestampDay(event.occurredAt)
    if (!entity || types.get(entity.entityTypeId) !== 'application'
      || event.eventType !== 'application.submitted' || day > asOfDay) continue
    const current = latest.get(entity.id)
    if (!current || event.createdAt > current.createdAt
      || (event.createdAt === current.createdAt && event.id > current.eventId)) {
      latest.set(entity.id, { entity, day, createdAt: event.createdAt, eventId: event.id })
    }
  }
  return [...latest.values()].map(({ entity, day }) => ({ entity, day }))
}

function cumulativeHistory(days: string[], months: MonthRange[]): RunHistoryPoint[] {
  return months.map((month) => ({ month: month.key, value: days.filter((day) => day <= month.end).length }))
}

function metric(current: number | null, target: number, history: RunHistoryPoint[], historyReady: boolean): RunMetric {
  return { current, target, history, historyReady }
}

function timestampDay(value: string): string { return dateKey(new Date(value)) }
function hasText(value: unknown): boolean { return typeof value === 'string' && value.trim().length > 0 }
function percent(numerator: number, denominator: number): number { return Math.round(numerator * 1000 / denominator) / 10 }
