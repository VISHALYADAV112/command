import { commandError } from './errors.ts'

export interface RegistryTypeRow {
  id: string
  type_key: string
  field_schema: unknown
  schema_version: number
  allowed_commitment_kinds: string[]
  is_active?: boolean
}

interface RegistryField {
  key: string
  kind: string
  required?: boolean
  deprecated?: boolean
  options?: unknown
}

export function assertCaptureFields(
  type: RegistryTypeRow,
  fields: Record<string, unknown>,
  schemaVersion: number,
): void {
  if (schemaVersion !== type.schema_version || !boundedObject(fields, 50, 65_536)) {
    throw commandError('invalid_fields')
  }
  const schema = Array.isArray(type.field_schema) ? type.field_schema as RegistryField[] : []
  const definitions = new Map(schema.map((field) => [field.key, field]))
  for (const field of schema) {
    const value = fields[field.key]
    if (!field.deprecated && field.required && (
      !Object.hasOwn(fields, field.key) || value == null || (typeof value === 'string' && !value.trim())
    )) {
      throw commandError('invalid_fields')
    }
  }
  for (const [key, value] of Object.entries(fields)) {
    const field = definitions.get(key)
    if (!field || !validFieldValue(field, value)) throw commandError('invalid_fields')
  }
}

export function assertSchedule(type: RegistryTypeRow, kind: string, dueOn: string): void {
  if (!type.allowed_commitment_kinds.includes(kind) || !validDate(dueOn)) {
    throw commandError('invalid_schedule')
  }
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

function boundedObject(value: Record<string, unknown>, maxFields: number, maxBytes: number): boolean {
  if (Object.keys(value).length > maxFields) return false
  try { return new TextEncoder().encode(JSON.stringify(value)).byteLength <= maxBytes } catch { return false }
}

function validFieldValue(field: RegistryField, value: unknown): boolean {
  if (value === null) return true
  if (field.kind === 'text') return typeof value === 'string' && value.length <= 500
  if (field.kind === 'textarea') return typeof value === 'string' && value.length <= 10_000
  if (field.kind === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (field.kind === 'boolean') return typeof value === 'boolean'
  if (field.kind === 'date') return typeof value === 'string' && validDate(value)
  if (field.kind === 'url') return typeof value === 'string' && value.length <= 2_000 && validHttpUrl(value)
  if (field.kind === 'single_select') {
    return typeof value === 'string' && Array.isArray(field.options) && field.options.includes(value)
  }
  return false
}

function validHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return !/\s/.test(value) && (parsed.protocol === 'http:' || parsed.protocol === 'https:')
  } catch { return false }
}
