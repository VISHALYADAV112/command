import { useEffect, useMemo, useState } from 'react'
import { dateKey } from '../domain'
import type { CommandData, RunMetric, RunSummary } from '../types'
import { ViewShell } from '../ui'
import { deriveRunSummary } from '../v3Run'

interface MarkerSpec {
  key: string
  title: string
  unit: 'count' | 'percent'
  unitLabel: string
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
  return <main><ViewShell eyebrow="Section 06 · Trailing velocity & markers" title="The run">
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
        <span>of {displayValue(metric.target, marker.unit)} {marker.unitLabel}</span>
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
      ? <History metric={metric} title={marker.title} />
      : <p className="run-insufficient">Trend withheld · needs three completed months of data</p>}
  </article>
}

function History({ metric, title }: { metric: RunMetric; title: string }) {
  return <p className="run-history" aria-label={`${title} completed-month history`}>
    {metric.history.map((point) => point.value === null ? '—' : String(point.value)).join(' \u2192 ')}
  </p>
}

function markerSpecs(summary: RunSummary): MarkerSpec[] {
  return [
    {
      key: 'portfolio', title: 'Public portfolio projects shipped', unit: 'count', unitLabel: 'projects', metric: summary.publicPortfolio,
      context: 'Done, public, documented, with a repository or live demo.',
    },
    {
      key: 'patterns', title: 'DSA patterns mastered', unit: 'count', unitLabel: 'patterns', metric: summary.dsaPatterns,
      context: `${summary.dsaPatterns.covered} patterns covered; mastery requires confidence 5 and two mastery hits.`,
    },
    {
      key: 'mocks', title: 'Mock technical interviews held', unit: 'count', unitLabel: 'mocks', metric: summary.mockInterviews,
      context: 'Completed drill commitments explicitly titled “Mock interview…”.',
    },
    {
      key: 'conversion', title: 'Screen-to-technical conversion', unit: 'percent', unitLabel: '', metric: summary.applicationConversion,
      context: `${summary.applicationConversion.numerator} of ${summary.applicationConversion.denominator} submitted applications currently at phone, onsite, or offer.`,
    },
    {
      key: 'referrals', title: 'Referral conversations completed', unit: 'count', unitLabel: 'contacts', metric: summary.referralConversations,
      context: 'Distinct people with a completed contact commitment.',
    },
  ]
}

function trendLabel(metric: RunMetric, unit: MarkerSpec['unit']): string {
  const [, previous, last] = metric.history.map((point) => point.value)
  if (previous === null || last === null) return 'Trend unavailable'
  const change = Math.round((last - previous) * 10) / 10
  const period = unit === 'percent' ? 'vs baseline' : 'this month'
  if (change === 0) return `Flat ${period}`
  return `${change > 0 ? '+' : '\u2212'}${displayValue(Math.abs(change), unit)} ${period}`
}

function displayValue(value: number | null, unit: MarkerSpec['unit']): string {
  if (value === null) return '—'
  return unit === 'percent' ? `${value.toFixed(1)}%` : String(value)
}
