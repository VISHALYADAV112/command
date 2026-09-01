import { describe, expect, it } from 'vitest'
import { createDemoData } from '../data'
import { settings } from '../domain'
import type { DbActivityEvent, DbAgentProposal, DbCommitment, DbEntity, DbEntityType } from './db.rows'
import {
  applicationToDb, commitmentToDb, entityToDb, entityTypeToDb, ideaToDb, learningToDb, logToDb,
  mapActivityEvent, mapAgentProposal, mapApplication, mapCommitment, mapEntity, mapEntityType, mapIdea, mapLearning, mapLog, mapPerson,
  mapProject, mapSettings, personToDb, projectToDb, settingsToDb,
} from './mappers'

describe('database mappers', () => {
  const data = createDemoData(new Date('2026-08-25T06:00:00Z'))

  it('round-trips every persisted model field', () => {
    const legacy = data.legacy
    expect(mapApplication(applicationToDb(legacy.applications[0]))).toEqual(legacy.applications[0])
    expect(mapPerson(personToDb(legacy.people[0]))).toEqual(legacy.people[0])
    expect(mapProject(projectToDb(legacy.projects[0]))).toEqual(legacy.projects[0])
    expect(mapIdea(ideaToDb(legacy.ideas[0]))).toEqual(legacy.ideas[0])
    expect(mapLearning(learningToDb(legacy.learning[0]))).toEqual(legacy.learning[0])
    expect(mapLog({ id: crypto.randomUUID(), ...logToDb(legacy.logs[0]) })).toEqual(legacy.logs[0])
  })

  it('keeps target settings at the mapper boundary', () => {
    expect(mapSettings({ user_id: crypto.randomUUID(), ...settingsToDb(settings) })).toEqual(settings)
  })

  it('keeps registry JSON snake_case inside the mapper boundary', () => {
    const row: DbEntityType = {
      id: '33333333-3333-4333-8333-333333333333',
      type_key: 'interview_topic',
      singular_name: 'Interview topic',
      plural_name: 'Interview topics',
      icon_key: 'generic',
      schema_version: 2,
      field_schema: [{
        key: 'stage', label: 'Stage', kind: 'single_select', required: true,
        list_visible: true, filterable: true, deprecated: false,
        options: ['screen', 'technical'],
      }],
      default_sort_field: 'stage',
      default_sort_direction: 'asc',
      group_by_field: 'stage',
      allowed_commitment_kinds: ['review'],
      plugin_key: null,
      is_active: true,
    }

    const mapped = mapEntityType(row)
    expect(mapped).toMatchObject({
      typeKey: 'interview_topic',
      schemaVersion: 2,
      fields: [{ key: 'stage', listVisible: true, options: ['screen', 'technical'] }],
      allowedCommitmentKinds: ['review'],
    })
    expect(entityTypeToDb(mapped)).toEqual(row)
  })

  it('round-trips canonical entity fields and archive state', () => {
    const row: DbEntity = {
      id: '55555555-5555-4555-8555-555555555555',
      entity_type_id: '33333333-3333-4333-8333-333333333333',
      title: 'Acme — Engineer',
      fields: {
        company: 'Acme', score: 4.5, referred: true,
        applied_on: '2026-08-31', optional: null,
      },
      schema_version: 2,
      archived_at: '2026-08-31T12:00:00.000Z',
      created_at: '2026-08-20T12:00:00.000Z',
      updated_at: '2026-08-31T12:00:00.000Z',
    }

    const mapped = mapEntity(row)
    expect(mapped).toMatchObject({
      entityTypeId: '33333333-3333-4333-8333-333333333333',
      schemaVersion: 2,
      fields: { company: 'Acme', score: 4.5, referred: true, optional: null },
      archivedAt: '2026-08-31T12:00:00.000Z',
    })
    const { created_at: _createdAt, updated_at: _updatedAt, ...writeRow } = row
    expect(entityToDb(mapped)).toEqual(writeRow)
  })

  it('maps commitments, immutable activity, and proposal review state', () => {
    const commitment: DbCommitment = {
      id: '88888888-8888-4888-8888-888888888888',
      entity_id: '55555555-5555-4555-8555-555555555555',
      kind: 'follow-up',
      action: 'Send a follow-up',
      due_on: '2026-09-02',
      state: 'completed',
      outcome: 'Reply received',
      completed_at: '2026-09-02T12:00:00.000Z',
      origin_source: 'mcp',
    }
    expect(commitmentToDb(mapCommitment(commitment))).toEqual(commitment)

    const event: DbActivityEvent = {
      id: '99999999-9999-4999-8999-999999999999',
      entity_id: commitment.entity_id,
      commitment_id: commitment.id,
      event_type: 'commitment.completed',
      payload: { outcome: 'Reply received' },
      source: 'mcp',
      client_id: 'test-client',
      idempotency_key: 'proposal-event-001',
      occurred_at: '2026-09-02T12:00:00.000Z',
      created_at: '2026-09-02T12:00:01.000Z',
    }
    expect(mapActivityEvent(event)).toMatchObject({
      eventType: 'commitment.completed',
      commitmentId: commitment.id,
      source: 'mcp',
      clientId: 'test-client',
    })

    const proposal: DbAgentProposal = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      client_id: 'test-client',
      operation: 'complete',
      entity_type_id: '33333333-3333-4333-8333-333333333333',
      target_entity_id: commitment.entity_id,
      target_commitment_id: commitment.id,
      target_updated_at: '2026-09-02T11:00:00.000Z',
      proposed_entity: null,
      proposed_commitment: { outcome: 'Reply received' },
      state: 'approved',
      decision_note: 'Reviewed',
      result_entity_id: commitment.entity_id,
      result_commitment_id: commitment.id,
      result_event_id: event.id,
      idempotency_key: 'proposal-complete-001',
      expires_at: '2026-09-09T11:00:00.000Z',
      decided_at: '2026-09-02T12:00:00.000Z',
      created_at: '2026-09-02T11:00:00.000Z',
    }
    expect(mapAgentProposal(proposal)).toMatchObject({
      operation: 'complete',
      state: 'approved',
      proposedCommitment: { outcome: 'Reply received' },
      resultEventId: event.id,
    })
  })
})
