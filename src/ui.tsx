import { useEffect, type ReactNode } from 'react'

// Client-generated primary keys must be valid UUIDs — every remote table's
// id column is uuid typed, so no textual prefixes on persisted entities.
export function uid(_prefix?: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function GateMark() {
  return <span className="gate-mark" aria-hidden="true" />
}

export function Icon({ name }: { name: 'arrow' | 'check' | 'close' | 'plus' | 'settings' | 'spark' }) {
  const paths = {
    arrow: <><path d="M5 12h14" /><path d="m14 7 5 5-5 5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <><path d="m6 6 12 12" /><path d="m18 6-12 12" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    settings: <><path d="M4 8h16" /><path d="M4 16h16" /><circle cx="9" cy="8" r="2.5" /><circle cx="15" cy="16" r="2.5" /></>,
    spark: <><path d="m12 3 1.4 4.2L18 9l-4.6 1.8L12 15l-1.4-4.2L6 9l4.6-1.8L12 3Z" /><path d="m19 15 .7 2.1L22 18l-2.3.9L19 21l-.7-2.1L16 18l2.3-.9L19 15Z" /></>,
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" strokeLinejoin="miter">{paths[name]}</svg>
}

export function Sheet({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.body.classList.add('sheet-open')
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('sheet-open')
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <header className="sheet-header">
          <div><span className="eyebrow">{eyebrow}</span><h2 id="sheet-title">{title}</h2></div>
          <button className="icon-button sheet-close" type="button" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </header>
        {children}
      </section>
    </div>
  )
}

export function ViewShell({ eyebrow, title, aside, children }: { eyebrow: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="zone view-zone" aria-labelledby="view-title">
      <div className="zone-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2 id="view-title">{title}</h2>
        </div>
        {aside && <div className="zone-aside">{aside}</div>}
      </div>
      {children}
    </section>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <div className="empty-state"><Icon name="spark" /><p>{message}</p></div>
}
