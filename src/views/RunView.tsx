import { useEffect, useMemo, useState } from 'react'
import { dateFromKey, dateKey } from '../domain'
import type { CommandData, RunMetric, RunSummary } from '../types'
import { ViewShell } from '../ui'
import { deriveRunSummary } from '../v3Run'

interface MarkerSpec {
  key: string
  title: string
  unit: 'count' | 'percent'
  metric: RunMetric
  context: string
}

export function RunView({ data, today, loadSummary }: {
  data: CommandData
  today: Date
  loadSummary?: (day: string) => Promise<RunSummary>
}) {
  const local = useMemo(() => deriveRunSummary(data, today), [data, today])
  const [remote, setRemote] = useState<RunSummary | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    setRemote(null)
    if (!loadSummary) {
      setLoadError(false)
      return
    }
    let active = true
    setLoadError(false)
    void loadSummary(dateKey(today))
      .then((summary) => { if (active) setRemote(summary) })
      .catch(() => { if (active) setLoadError(true) })
    return () => { active = false }
  }, [loadSummary, today])

  const summary = remote ?? local
  const markers = markerSpecs(summary)
  return <main><ViewShell eyebrow="Monthly readiness" title="The run" aside={historyRange(summary)}>
    <p className="run-intro">Five slow signals answer whether the work is compounding. Review them monthly; daily movement belongs on Today and Week.</p>
    {loadError && <p className="view-hint" role="status">Could not refresh Run. Showing the latest cached summary.</p>}
    <section className="run-marker-grid" aria-label="Readiness markers">
      {markers.map((marker) => <MarkerCard marker={marker} key={marker.key} />)}
    </section>
  </ViewShell></main>
}

function MarkerCard({ marker }: { marker: MarkerSpec }) {
  const { metric } = marker
  const progress = metric.current === null || metric.target <= 0 ? 0 : Math.min(100, metric.current / metric.target * 100)
  return <article className="run-marker">
    <div className="run-marker-copy">
      <header><span>Readiness marker</span><h3>{marker.title}</h3></header>
      <div className="run-current">
        <strong>{displayValue(metric.current, marker.unit)}</strong>
        <span>of {displayValue(metric.target, marker.unit)} target</span>
      </div>
      <p className="run-context">{marker.context}</p>
    </div>
    <div className="run-marker-progress">
      <div className="run-progress" role="progressbar" aria-label={`${marker.title} progress`} aria-valuemin={0} aria-valuemax={metric.target} aria-valuenow={Math.min(metric.target, metric.current ?? 0)} aria-valuetext={`${displayValue(metric.current, marker.unit)} of ${displayValue(metric.target, marker.unit)}`}>
        <span style={{ width: `${progress}%` }} />
      </div>
      {metric.historyReady && <p className="run-trend">{trendLabel(metric, marker.unit)}</p>}
    </div>
    {metric.historyReady
      ? <History metric={metric} unit={marker.unit} title={marker.title} />
      : <p className="run-insufficient">Trend withheld · needs three completed months of data</p>}
  </article>
}

function History({ metric, unit, title }: { metric: RunMetric; unit: MarkerSpec['unit']; title: string }) {
  return <div className="run-history" role="group" aria-label={`${title} completed-month history`}>
    {metric.history.map((point) => <div key={point.month}>
      <span>{monthLabel(point.month)}</span><strong>{displayValue(point.value, unit)}</strong>
    </div>)}
  </div>
}

function markerSpecs(summary: RunSummary): MarkerSpec[] {
  return [
    {
      key: 'portfolio', title: 'Public portfolio projects', unit: 'count', metric: summary.publicPortfolio,
      context: 'Done, public, documented, with a repository or live demo.',
    },
    {
      key: 'patterns', title: 'DSA patterns mastered', unit: 'count', metric: summary.dsaPatterns,
      context: `${summary.dsaPatterns.covered} patterns covered; mastery requires confidence 5 and two mastery hits.`,
    },
    {
      key: 'mocks', title: 'Mock interviews completed', unit: 'count', metric: summary.mockInterviews,
      context: 'Completed drill commitments explicitly titled “Mock interview…”.',
    },
    {
      key: 'conversion', title: 'Application to first round', unit: 'percent', metric: summary.applicationConversion,
      context: `${summary.applicationConversion.numerator} of ${summary.applicationConversion.denominator} submitted applications currently at phone, onsite, or offer.`,
    },
    {
      key: 'referrals', title: 'Referral conversations held', unit: 'count', metric: summary.referralConversations,
      context: 'Distinct people with a completed contact commitment.',
    },
  ]
}

function trendLabel(metric: RunMetric, unit: MarkerSpec['unit']): string {
  const [first, , last] = metric.history.map((point) => point.value)
  if (first === null || last === null) return 'Trend unavailable'
  const change = Math.round((last - first) * 10) / 10
  if (change === 0) return 'Flat across the three completed months'
  const value = displayValue(Math.abs(change), unit)
  return `${change > 0 ? '+' : '−'}${value} from oldest to latest completed month`
}

function displayValue(value: number | null, unit: MarkerSpec['unit']): string {
  if (value === null) return '—'
  return unit === 'percent' ? `${value}%` : String(value)
}

function monthLabel(value: string): string {
  return dateFromKey(`${value}-01`).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short', year: '2-digit' })
}

function historyRange(summary: RunSummary): string {
  return `${monthLabel(summary.historyStart.slice(0, 7))} — ${monthLabel(summary.historyEnd.slice(0, 7))} · completed months`
}
