import { dateKey } from './domain'
import type { CommandData, Settings } from './types'
import { threeFloorStatus } from './v3Selectors'

const issueEpoch = new Date('2026-08-29T06:30:00.000Z')

export function gazetteIssueNumber(today: Date): number {
  const day = dateKey(today)
  return 829 + Math.round((Date.parse(`${day}T06:30:00.000Z`) - issueEpoch.getTime()) / 86_400_000)
}

export function AppHeader({ today, live, preview = false, theme, data, settings, onToggleTheme }: {
  today: Date
  live: boolean
  preview?: boolean
  theme: 'day' | 'night'
  data: CommandData
  settings: Settings
  onToggleTheme: () => void
}) {
  const day = dateKey(today)
  const floorsMet = threeFloorStatus(data, settings, today).filter((floor) => floor.met).length
  const activeEntityIds = new Set(data.entities.filter((item) => !item.archivedAt).map((item) => item.id))
  const open = data.commitments.filter((item) => item.state === 'open' && activeEntityIds.has(item.entityId))
  const overdue = open.filter((item) => item.dueOn < day).length
  const issueNo = gazetteIssueNumber(today)
  const longDate = today.toLocaleDateString('en-GB', {
    timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const floorTotal = settings.floors.node + settings.floors.dsa + settings.floors.math

  return (
    <header className="app-header">
      <div className="gazette-dateline">
        <div><strong>Vol. III · No. {issueNo}</strong><i>—</i><span>Pune, GMT+5:30</span><i>—</i><time dateTime={day}>{longDate}</time></div>
        <div>
          <span>Floors <strong>{floorsMet}/3</strong></span><i>·</i>
          <span>{open.length} open <strong className="urgent-ink">/ {overdue} overdue</strong></span>
          <button className="edition-toggle" type="button" onClick={onToggleTheme}>{theme === 'night' ? 'Day edition' : 'Night edition'}</button>
          <span className={live || preview ? 'wire-state is-live' : 'wire-state'}><b aria-hidden="true" />Wire: {live ? 'live' : preview ? 'preview' : 'local'}</span>
        </div>
      </div>

      <div className="gazette-masthead">
        <p>Executive Operational Dispatch &amp; Registry</p>
        <a href="#/" aria-label="The Command Gazette home"><h1><span>The Command</span> <span>Gazette</span></h1></a>
      </div>

      <div className="gazette-maxim">
        <span>Floor target {floorTotal}m</span>
        <span className="gazette-verse">
          <em>karmaṇy evādhikāras te mā phaleṣu kadācana</em>
          <b lang="sa-Brah">𑀓𑀭𑁆𑀫𑀡𑁆𑀬𑁂𑀯𑀸𑀥𑀺𑀓𑀸𑀭𑀲𑁆𑀢𑁂 · 𑀫𑀸 𑀨𑀮𑁂𑀱𑀼 𑀓𑀤𑀸𑀘𑀦</b>
        </span>
        <span className="edition-link">Edition v12</span>
      </div>
    </header>
  )
}
