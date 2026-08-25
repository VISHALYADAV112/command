import { useEffect, useState, type FormEvent } from 'react'
import { compactDuration, dateFromKey, minutesFor, practices } from '../domain'
import type { DailyLog, PracticeKey, Settings } from '../types'
import { Icon, Sheet } from '../ui'

interface Props {
  log: DailyLog
  settings: Settings
  onSave: (log: DailyLog) => boolean
  onClose: () => void
}

export function DailyLogSheet({ log, settings, onSave, onClose }: Props) {
  const draftKey = `command.draft.${log.day}`
  const [draft, setDraft] = useState<DailyLog>(() => {
    try {
      const stored = localStorage.getItem(draftKey)
      return stored ? JSON.parse(stored) as DailyLog : log
    } catch { return log }
  })

  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify(draft)) } catch { /* draft is best-effort */ }
  }, [draft, draftKey])

  function setMinutes(key: PracticeKey, value: number) {
    const field = key === 'node' ? 'nodeMinutes' : key === 'dsa' ? 'dsaMinutes' : key === 'math' ? 'mathMinutes' : 'jobMinutes'
    setDraft((current) => ({ ...current, [field]: Math.max(0, Math.round(value)) }))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!onSave(draft)) return
    try { localStorage.removeItem(draftKey) } catch { /* draft is best-effort */ }
    onClose()
  }

  const title = dateFromKey(log.day).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <Sheet title="Log today" eyebrow={title} onClose={onClose}>
      <form className="daily-form" onSubmit={submit}>
        <fieldset className="habit-fieldset">
          <legend>Daily signals</legend>
          <Habit label="Meditation" checked={draft.meditation} onChange={(meditation) => setDraft({ ...draft, meditation })} />
          <Habit label="Gym" checked={draft.gym} onChange={(gym) => setDraft({ ...draft, gym })} />
        </fieldset>

        <fieldset className="diet-fieldset">
          <legend>Diet</legend>
          {(['on_track', 'loose', 'off'] as const).map((diet) => (
            <label className={draft.diet === diet ? 'is-selected' : ''} key={diet}>
              <input type="radio" name="diet" checked={draft.diet === diet} onChange={() => setDraft({ ...draft, diet })} />
              {diet.replace('_', ' ')}
            </label>
          ))}
        </fieldset>

        <fieldset className="time-fieldset">
          <legend>Actual time</legend>
          {practices.map(({ key, label }) => {
            const value = minutesFor(draft, key)
            const met = value >= settings.floors[key]
            return (
              <div className={`time-row ${met ? 'is-met' : ''}`} key={key}>
                <div className="time-label"><span>{label}</span><small>{met ? 'Floor met' : `${compactDuration(settings.floors[key] - value)} to floor`}</small></div>
                <div className="time-control">
                  <button type="button" onClick={() => setMinutes(key, value - 15)} aria-label={`Remove 15 minutes from ${label}`}>−</button>
                  <label><input type="number" inputMode="numeric" min="0" step="5" value={value} onChange={(event) => setMinutes(key, Number(event.target.value))} /><span>min</span></label>
                  <button type="button" onClick={() => setMinutes(key, value + 15)} aria-label={`Add 15 minutes to ${label}`}>+</button>
                </div>
              </div>
            )
          })}
        </fieldset>

        <label className="note-field">One-line note <span>optional</span><input type="text" maxLength={140} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="What mattered today?" /></label>
        <div className="form-actions"><button className="primary-button" type="submit"><span>Save today</span><Icon name="check" /></button></div>
      </form>
    </Sheet>
  )
}

function Habit({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className={checked ? 'is-checked' : ''}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span><Icon name="check" /></span>{label}
    </label>
  )
}
