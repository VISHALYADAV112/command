import { createDemoData } from '../data'
import { settings as defaultSettings } from '../domain'
import type { CommandData, LegacyCommandData, Settings } from '../types'
import { isCommandData, upgradeLegacyData } from '../v3Data'

const DATA_KEY = 'command.prototype.v3'
const SETTINGS_KEY = 'command.prototype.settings.v3'
const LIVE_CACHE_KEY = 'command.live-cache.v3'
const LEGACY_DATA_KEY = 'command.prototype.v1'
const LEGACY_SETTINGS_KEY = 'command.prototype.settings.v1'
const LEGACY_LIVE_CACHE_KEY = 'command.live-cache.v1'

interface CacheEnvelope<T> {
  version: 3
  data: T
}

export function readDemoData(): CommandData {
  const current = readCommandData(DATA_KEY)
  if (current) return current

  const legacy = readLegacyData(LEGACY_DATA_KEY)
  if (!legacy) return createDemoData()
  const migrated = upgradeLegacyData(legacy)
  writeDemoData(migrated)
  return migrated
}

export function writeDemoData(data: CommandData): void {
  write(DATA_KEY, envelope(data))
}

export function readStoredSettings(): Settings | null {
  const current = readJson(SETTINGS_KEY)
  if (isEnvelope(current) && current.data && typeof current.data === 'object') {
    return normalizeSettings(current.data as Partial<Settings>)
  }

  const legacy = readJson(LEGACY_SETTINGS_KEY)
  if (!legacy || typeof legacy !== 'object') return null
  const migrated = normalizeSettings(legacy as Partial<Settings>)
  writeStoredSettings(migrated)
  return migrated
}

export function writeStoredSettings(settings: Settings): void {
  write(SETTINGS_KEY, envelope(settings))
}

export function readLiveCache(): CommandData | null {
  const current = readCommandData(LIVE_CACHE_KEY)
  if (current) return current

  const legacy = readLegacyData(LEGACY_LIVE_CACHE_KEY)
  if (!legacy) return null
  const migrated = upgradeLegacyData(legacy)
  writeLiveCache(migrated)
  return migrated
}

export function writeLiveCache(data: CommandData): void {
  write(LIVE_CACHE_KEY, envelope(data))
}

export function clearDemoCache(): void {
  try {
    localStorage.removeItem(DATA_KEY)
    localStorage.removeItem(SETTINGS_KEY)
    localStorage.removeItem(LEGACY_DATA_KEY)
    localStorage.removeItem(LEGACY_SETTINGS_KEY)
  } catch { /* browser storage is best-effort */ }
}

function readCommandData(key: string): CommandData | null {
  const parsed = readJson(key)
  if (!isEnvelope(parsed) || !isCommandData(parsed.data)) return null
  return parsed.data
}

function readLegacyData(key: string): Partial<LegacyCommandData> | null {
  const parsed = readJson(key)
  if (!parsed || typeof parsed !== 'object') return null
  return parsed as Partial<LegacyCommandData>
}

function readJson(key: string): unknown {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : null
  } catch { return null }
}

function isEnvelope(value: unknown): value is CacheEnvelope<unknown> {
  if (!value || typeof value !== 'object') return false
  const cache = value as Partial<CacheEnvelope<unknown>>
  return cache.version === 3 && 'data' in cache
}

function normalizeSettings(raw: Partial<Settings>): Settings {
  return {
    ...raw,
    theme: raw.theme === 'day' ? 'day' : 'night',
    floors: raw.floors ?? defaultSettings.floors,
    budgets: raw.budgets ?? defaultSettings.budgets,
    weeklyTargets: raw.weeklyTargets ?? { applications: 15, peopleContacted: 2 },
  }
}

function envelope<T>(data: T): CacheEnvelope<T> {
  return { version: 3, data }
}

function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* browser storage is best-effort */ }
}
