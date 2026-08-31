import { createDemoData } from '../data'
import { settings as defaultSettings } from '../domain'
import type { CommandData, Settings } from '../types'

const DATA_KEY = 'command.prototype.v1'
const SETTINGS_KEY = 'command.prototype.settings.v1'
const LIVE_CACHE_KEY = 'command.live-cache.v1'

export function readDemoData(): CommandData {
  return readData(DATA_KEY) ?? createDemoData()
}

export function writeDemoData(data: CommandData): void {
  write(DATA_KEY, data)
}

export function readStoredSettings(): Settings | null {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored) as Partial<Settings>
    return {
      ...parsed,
      theme: parsed.theme === 'day' ? 'day' : 'night',
      floors: parsed.floors ?? defaultSettings.floors,
      budgets: parsed.budgets ?? defaultSettings.budgets,
      weeklyTargets: parsed.weeklyTargets ?? { applications: 15, peopleContacted: 2 },
    }
  } catch { return null }
}

export function writeStoredSettings(settings: Settings): void {
  write(SETTINGS_KEY, settings)
}

export function readLiveCache(): CommandData | null {
  return readData(LIVE_CACHE_KEY)
}

export function writeLiveCache(data: CommandData): void {
  write(LIVE_CACHE_KEY, data)
}

export function clearDemoCache(): void {
  try {
    localStorage.removeItem(DATA_KEY)
    localStorage.removeItem(SETTINGS_KEY)
  } catch { /* browser storage is best-effort */ }
}

function readData(key: string): CommandData | null {
  try {
    const stored = localStorage.getItem(key)
    return stored ? normalizeData(JSON.parse(stored) as Partial<CommandData>) : null
  } catch { return null }
}

// Older browser caches predate several fields. Fill only missing values so a
// release never turns existing user data into uncontrolled form values.
function normalizeData(raw: Partial<CommandData>): CommandData {
  return {
    logs: Array.isArray(raw.logs) ? raw.logs : [],
    applications: (Array.isArray(raw.applications) ? raw.applications : []).map((item) => ({
      ...item,
      appliedOn: item.appliedOn ?? null,
      hasReferral: item.hasReferral ?? false,
      resumeVersion: item.resumeVersion ?? '',
      resumeDriveUrl: item.resumeDriveUrl ?? '',
      notes: item.notes ?? '',
    })),
    people: (Array.isArray(raw.people) ? raw.people : []).map((item) => ({
      ...item,
      email: item.email ?? '',
      linkedinUrl: item.linkedinUrl ?? '',
      howKnown: item.howKnown ?? null,
      lastContactOn: item.lastContactOn ?? null,
      notes: item.notes ?? '',
    })),
    projects: (Array.isArray(raw.projects) ? raw.projects : []).map((item) => ({
      ...item,
      client: item.client ?? '',
      paymentStatus: item.paymentStatus ?? 'na',
      amount: item.amount ?? null,
      currency: item.currency ?? 'INR',
      isPublic: item.isPublic ?? false,
      repoUrl: item.repoUrl ?? '',
      demoUrl: item.demoUrl ?? '',
      driveFolderUrl: item.driveFolderUrl ?? '',
      content: item.content ?? '',
    })),
    learning: (Array.isArray(raw.learning) ? raw.learning : []).map((item) => ({
      ...item,
      stack: item.stack ?? 'brain',
      difficulty: item.difficulty ?? null,
      lastReviewedOn: item.lastReviewedOn ?? null,
      sourceUrl: item.sourceUrl ?? '',
    })),
    ideas: (Array.isArray(raw.ideas) ? raw.ideas : []).map((item) => ({
      ...item,
      problem: item.problem ?? '',
      targetMarket: item.targetMarket ?? '',
      monetization: item.monetization ?? '',
    })),
  }
}

function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* browser storage is best-effort */ }
}
