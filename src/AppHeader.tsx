import { dateKey } from './domain'
import type { CommandData, Settings } from './types'
import { threeFloorStatus } from './v3Selectors'

const issueEpoch = new Date('2026-08-29T06:30:00.000Z')

export function AppHeader({ today, live, theme, data, settings, onOpenSettings, onToggleTheme }: {
  today: Date
  live: boolean
  theme: 'day' | 'night'
  data: CommandData
  settings: Settings
  onOpenSettings: () => void
  onToggleTheme: () => void
}) {
  const day = dateKey(today)
  const floorsMet = threeFloorStatus(data, settings, today).filter((floor) => floor.met).length
  const open = data.commitments.filter((item) => item.state === 'open')
  const overdue = open.filter((item) => item.dueOn < day).length
  const issueNo = 829 + Math.round((Date.parse(`${day}T06:30:00.000Z`) - issueEpoch.getTime()) / 86_400_000)
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
          <button type="button" onClick={onToggleTheme}>{theme === 'night' ? 'Day edition' : 'Night edition'}</button>
          <span className={live ? 'wire-state is-live' : 'wire-state'}><b aria-hidden="true" />Wire: {live ? 'live' : 'local'}</span>
        </div>
      </div>

      <div className="gazette-masthead">
        <p>Executive Operational Dispatch &amp; Registry</p>
        <a href="#/" aria-label="The Command Gazette home"><h1>The Command Gazette</h1></a>
      </div>

      <div className="gazette-maxim">
        <span>Floor target {floorTotal}m</span>
        <span className="gazette-verse">
          <em>karmaṇy evādhikāras te mā phaleṣu kadācana</em>
          <b lang="sa-Brah">𑀓𑀭𑁆𑀫𑀡𑁆𑀬𑁂𑀯𑀸𑀥𑀺𑀓𑀸𑀭𑀲𑁆𑀢𑁂 · 𑀫𑀸 𑀨𑀮𑁂𑀱𑀼 𑀓𑀤𑀸𑀘𑀦</b>
        </span>
        <button className="edition-link" type="button" onClick={onOpenSettings}>Edition v12</button>
      </div>
    </header>
  )
}
