import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createDemoData } from './data'
import { settings } from './domain'
import { exportData, exportTypeCsv } from './lib/api'
import { TypeRegistrySettings } from './TypeRegistrySettings'

const today = new Date('2026-09-02T06:00:00.000Z')

describe('Phase 7 dynamic export', () => {
  it('exports the canonical registry without embedding legacy type tables', () => {
    const data = createDemoData(today)
    const exported = JSON.parse(exportData(data, settings))
    expect(exported).toMatchObject({ version: 3, settings, entityTypes: data.entityTypes, entities: data.entities })
    expect(exported.dailyLogs).toEqual(data.legacy.logs)
    expect(exported).not.toHaveProperty('legacy')
    expect(exported).not.toHaveProperty('applications')
  })

  it('builds CSV columns from any registry schema and retains archived rows', () => {
    const data = createDemoData(today)
    const type = {
      ...data.entityTypes[4], id: crypto.randomUUID(), typeKey: 'book', singularName: 'Book', pluralName: 'Books',
      fields: [
        { key: 'author', label: 'Author', kind: 'text' as const, required: false, listVisible: true, filterable: true, deprecated: false, options: [] },
        { key: 'comment', label: 'Comment', kind: 'textarea' as const, required: false, listVisible: false, filterable: false, deprecated: true, options: [] },
      ],
    }
    data.entityTypes.push(type)
    data.entities.push({
      id: crypto.randomUUID(), entityTypeId: type.id, title: 'A "quoted" book', fields: { author: 'A. Writer', comment: 'line one\nline two' },
      schemaVersion: 2, archivedAt: '2026-09-01T00:00:00.000Z', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
    })
    const csv = exportTypeCsv(type, data)
    expect(csv.split('\n')[0]).toBe('type_key,id,title,schema_version,archived_at,created_at,updated_at,author,comment')
    expect(csv).toContain('"A ""quoted"" book"')
    expect(csv).toContain('"line one\nline two"')
  })
})

describe('Phase 7 type registry settings', () => {
  it('increments the schema version when an existing field definition changes', () => {
    const data = createDemoData(today)
    const note = data.entityTypes.find((type) => type.typeKey === 'note')!
    const onSave = vi.fn().mockReturnValue(true)
    render(<TypeRegistrySettings types={[note]} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: /Notes/ }))
    fireEvent.change(screen.getAllByLabelText('Label')[0], { target: { value: 'Category' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save type' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ schemaVersion: note.schemaVersion + 1 }))
  })

  it('creates a deployment-free data-only type at schema version one', () => {
    const onSave = vi.fn().mockReturnValue(true)
    render(<TypeRegistrySettings types={[]} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Create data type' }))
    fireEvent.change(screen.getByLabelText('Type key'), { target: { value: 'reading list' } })
    fireEvent.change(screen.getByLabelText('Singular name'), { target: { value: 'Book' } })
    fireEvent.change(screen.getByLabelText('Plural name'), { target: { value: 'Books' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add field' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save type' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      typeKey: 'reading_list', schemaVersion: 1, pluginKey: null, isActive: true,
    }))
  })
})
