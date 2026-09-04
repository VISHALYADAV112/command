import { currentWeek, dateKey, weeklyTotals } from './domain'
import type { AgentProposal, CommandData, Settings, WeekSummary } from './types'
import { weeklyOutcomeProgress } from './v3Selectors'

export function deriveWeekSummary(data: CommandData, settings: Settings, today: Date): WeekSummary {
  const week = currentWeek(today)
  const [weekStart, , , , , , weekEnd] = week.map(dateKey)
  const todayKey = dateKey(today)
  const logs = new Map(data.legacy.logs.map((log) => [log.day, log]))
  const activeEntityIds = new Set(data.entities.filter((item) => !item.archivedAt).map((item) => item.id))
  const totals = weeklyTotals(data.legacy.logs, week)
  const outcomes = weeklyOutcomeProgress(data, today)
  const inWeek = (value: string | null): boolean => Boolean(value && timestampDay(value) >= weekStart && timestampDay(value) <= weekEnd)

  return {
    weekStart,
    weekEnd,
    days: week.map((date) => {
      const day = dateKey(date)
      const log = logs.get(day)
      return {
        day,
        isFuture: day > todayKey,
        hasLog: Boolean(log),
        nodeMinutes: log?.nodeMinutes ?? null,
        dsaMinutes: log?.dsaMinutes ?? null,
        mathMinutes: log?.mathMinutes ?? null,
        meditation: log?.meditation ?? null,
        gym: log?.gym ?? null,
        diet: log?.diet ?? null,
      }
    }),
    practice: {
      node: { minutes: totals.node, target: settings.budgets.node },
      dsa: { minutes: totals.dsa, target: settings.budgets.dsa },
      math: { minutes: totals.math, target: settings.budgets.math },
    },
    applicationsSubmitted: outcomes.applications,
    applicationTarget: settings.weeklyTargets.applications,
    peopleContacted: outcomes.peopleContacted,
    peopleTarget: settings.weeklyTargets.peopleContacted,
    commitments: {
      completed: data.commitments.filter((item) => item.state === 'completed' && inWeek(item.completedAt)).length,
      cancelled: data.activityEvents.filter((item) => item.eventType === 'commitment.cancelled' && inWeek(item.occurredAt)).length,
      missed: data.commitments.filter((item) => item.state === 'open'
        && activeEntityIds.has(item.entityId)
        && item.dueOn >= weekStart && item.dueOn <= weekEnd && item.dueOn < todayKey).length,
    },
    proposals: {
      proposed: data.agentProposals.filter((item) => inWeek(item.createdAt)).length,
      approved: decidedThisWeek(data.agentProposals, 'approved', inWeek),
      rejected: decidedThisWeek(data.agentProposals, 'rejected', inWeek),
    },
  }
}

export function weekHasActivity(summary: WeekSummary): boolean {
  return summary.days.some((day) => day.hasLog)
    || summary.applicationsSubmitted > 0
    || summary.peopleContacted > 0
    || Object.values(summary.commitments).some((count) => count > 0)
    || Object.values(summary.proposals).some((count) => count > 0)
}

function timestampDay(value: string): string {
  return dateKey(new Date(value))
}

function decidedThisWeek(
  proposals: AgentProposal[],
  state: 'approved' | 'rejected',
  inWeek: (value: string | null) => boolean,
): number {
  return proposals.filter((item) => item.state === state && inWeek(item.decidedAt)).length
}
