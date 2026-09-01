import { currentWeek, dateKey, dayDistance } from './domain'
import type { CommandData, Commitment, Entity, EntityFieldValue, EntityType, Settings } from './types'

export type DueWindow = 'overdue' | 'today' | 'week' | 'all'

export interface DueItem {
  commitment: Commitment
  entity: Entity
  type: EntityType
  dueStatus: 'overdue' | 'today' | 'upcoming'
}

export function findType(data: CommandData, typeKey: string | null | undefined): EntityType | undefined {
  return data.entityTypes.find((type) => type.typeKey === typeKey)
}

export function findEntity(data: CommandData, id: string | null | undefined): Entity | undefined {
  return data.entities.find((entity) => entity.id === id)
}

export function dueItems(data: CommandData, today: Date, window: DueWindow = 'all', typeKey?: string | null): DueItem[] {
  const types = new Map(data.entityTypes.map((type) => [type.id, type]))
  const entities = new Map(data.entities.map((entity) => [entity.id, entity]))
  const weekEnd = dateKey(currentWeek(today)[6])

  return data.commitments
    .filter((commitment) => commitment.state === 'open')
    .map((commitment) => {
      const entity = entities.get(commitment.entityId)
      const type = entity ? types.get(entity.entityTypeId) : undefined
      if (!entity || !type || entity.archivedAt) return null
      const dueStatus = commitment.dueOn < dateKey(today)
        ? 'overdue'
        : commitment.dueOn === dateKey(today) ? 'today' : 'upcoming'
      return { commitment, entity, type, dueStatus }
    })
    .filter((item): item is DueItem => item !== null)
    .filter((item) => !typeKey || item.type.typeKey === typeKey)
    .filter((item) => window === 'all'
      || (window === 'overdue' && item.dueStatus === 'overdue')
      || (window === 'today' && item.dueStatus === 'today')
      || (window === 'week' && item.commitment.dueOn >= dateKey(today) && item.commitment.dueOn <= weekEnd))
    .sort((left, right) => left.commitment.dueOn.localeCompare(right.commitment.dueOn)
      || left.commitment.id.localeCompare(right.commitment.id))
}

export function openCommitmentCount(data: CommandData, entityId: string): number {
  return data.commitments.filter((item) => item.entityId === entityId && item.state === 'open').length
}

export function browseEntities(
  data: CommandData,
  type: EntityType,
  query = '',
  filters: Record<string, string> = {},
): Entity[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const matching = data.entities.filter((entity) => {
    if (entity.entityTypeId !== type.id || entity.archivedAt) return false
    if (normalizedQuery && ![entity.title, ...Object.values(entity.fields).map(displayFieldValue)]
      .join(' ').toLocaleLowerCase().includes(normalizedQuery)) return false
    return type.fields.filter((field) => field.filterable && filters[field.key])
      .every((field) => String(entity.fields[field.key] ?? '') === filters[field.key])
  })

  const direction = type.defaultSortDirection === 'asc' ? 1 : -1
  return matching.sort((left, right) => {
    const leftValue = type.defaultSortField === 'title'
      ? left.title : displayFieldValue(left.fields[type.defaultSortField])
    const rightValue = type.defaultSortField === 'title'
      ? right.title : displayFieldValue(right.fields[type.defaultSortField])
    return direction * leftValue.localeCompare(rightValue) || left.id.localeCompare(right.id)
  })
}

export function threeFloorStatus(data: CommandData, settings: Settings, today: Date) {
  const log = data.legacy.logs.find((item) => item.day === dateKey(today))
  return [
    { key: 'node', label: 'Node', minutes: log?.nodeMinutes ?? 0, target: settings.floors.node },
    { key: 'dsa', label: 'DSA', minutes: log?.dsaMinutes ?? 0, target: settings.floors.dsa },
    { key: 'math', label: 'Math', minutes: log?.mathMinutes ?? 0, target: settings.floors.math },
  ].map((floor) => ({ ...floor, met: floor.minutes >= floor.target }))
}

export function weeklyOutcomeProgress(data: CommandData, today: Date) {
  const [weekStart, , , , , , weekEnd] = currentWeek(today).map(dateKey)
  const inWeek = (value: EntityFieldValue | undefined): boolean => typeof value === 'string' && value >= weekStart && value <= weekEnd
  const application = findType(data, 'application')
  const person = findType(data, 'person')
  const entities = data.entities.filter((entity) => !entity.archivedAt)
  return {
    applications: entities.filter((entity) => entity.entityTypeId === application?.id && inWeek(entity.fields.applied_on)).length,
    peopleContacted: entities.filter((entity) => entity.entityTypeId === person?.id && inWeek(entity.fields.last_contacted_on)).length,
  }
}

export function relativeDueLabel(today: Date, dueOn: string): string {
  const distance = dayDistance(today, dueOn)
  if (distance < 0) return `${Math.abs(distance)}d overdue`
  if (distance === 0) return 'Today'
  if (distance === 1) return 'Tomorrow'
  return dueOn
}

export function displayFieldValue(value: EntityFieldValue | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}
