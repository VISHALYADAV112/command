import type { BehaviourPluginKey, Commitment, Entity, EntityType, Recall } from './types'
import { indiaDateKey } from '../supabase/functions/_shared/command-domain'

export const BEHAVIOUR_PLUGIN_LABELS = {
  spaced_repetition: 'Spaced repetition',
} as const

export interface SpacedRepetitionPlan {
  confidence: number
  masteryHits: number
  reviewedOn: string
  suggestedNextOn: string | null
  entity: Entity
}

export interface BehaviourPlugin<TOutcome, TSchedule> {
  key: BehaviourPluginKey
  label: string
  validate: (type: EntityType, entity: Entity, commitment: Commitment) => boolean
  schedule: (entity: Entity, outcome: TOutcome, today: Date) => TSchedule
  derive: (entity: Entity) => Record<string, string | number | null>
}

export function recallSchedule(currentConfidence: number, currentMasteryHits: number, recall: Recall, today: Date) {
  const confidence = Math.max(1, Math.min(5,
    currentConfidence + (recall === 'instant' ? 1 : recall === 'struggled' ? -1 : recall === 'blank' ? -2 : 0),
  ))
  const masteryHits = confidence === 5 && recall === 'instant' ? currentMasteryHits + 1 : 0
  const reviewedOn = indiaDateKey(today)
  const interval = recall === 'instant' ? 21 : recall === 'effort' ? 7 : recall === 'struggled' ? 3 : 1
  const suggestedNextOn = masteryHits >= 2 ? null : addIndiaDays(reviewedOn, interval)

  return { confidence, masteryHits, reviewedOn, suggestedNextOn }
}

export function spacedRepetitionPlan(entity: Entity, recall: Recall, today: Date): SpacedRepetitionPlan {
  const result = recallSchedule(
    boundedInteger(entity.fields.confidence, 1, 5, 1),
    boundedInteger(entity.fields.mastery_hits, 0, 1_000_000, 0),
    recall,
    today,
  )

  return {
    ...result,
    entity: {
      ...entity,
      fields: {
        ...entity.fields,
        confidence: result.confidence,
        mastery_hits: result.masteryHits,
        last_reviewed_on: result.reviewedOn,
      },
      updatedAt: today.toISOString(),
    },
  }
}

export function supportsSpacedRepetition(type: EntityType | undefined, commitmentKind: string): boolean {
  return type?.pluginKey === 'spaced_repetition' && commitmentKind === 'review'
}

export function validSpacedRepetitionType(type: EntityType): boolean {
  const fields = new Map(type.fields.filter((field) => !field.deprecated).map((field) => [field.key, field]))
  return type.allowedCommitmentKinds.includes('review')
    && fields.get('confidence')?.kind === 'number'
    && fields.get('confidence')?.required === true
    && fields.get('mastery_hits')?.kind === 'number'
    && fields.get('mastery_hits')?.required === true
    && fields.get('last_reviewed_on')?.kind === 'date'
}

export const spacedRepetitionPlugin: BehaviourPlugin<Recall, SpacedRepetitionPlan> = {
  key: 'spaced_repetition',
  label: BEHAVIOUR_PLUGIN_LABELS.spaced_repetition,
  validate: (type, entity, commitment) => validSpacedRepetitionType(type)
    && supportsSpacedRepetition(type, commitment.kind)
    && typeof entity.fields.confidence === 'number'
    && typeof entity.fields.mastery_hits === 'number',
  schedule: spacedRepetitionPlan,
  derive: (entity) => ({
    confidence: typeof entity.fields.confidence === 'number' ? entity.fields.confidence : null,
    masteryHits: typeof entity.fields.mastery_hits === 'number' ? entity.fields.mastery_hits : null,
    lastReviewedOn: typeof entity.fields.last_reviewed_on === 'string' ? entity.fields.last_reviewed_on : null,
  }),
}

export function behaviourPlugin(key: BehaviourPluginKey | null): BehaviourPlugin<Recall, SpacedRepetitionPlan> | null {
  return key === 'spaced_repetition' ? spacedRepetitionPlugin : null
}

function boundedInteger(value: unknown, minimum: number, maximum: number, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value)
    ? Math.max(minimum, Math.min(maximum, value)) : fallback
}

function addIndiaDays(day: string, amount: number): string {
  const [year, month, date] = day.split('-').map(Number)
  const value = new Date(Date.UTC(year, month - 1, date + amount, 6, 30))
  return value.toISOString().slice(0, 10)
}
