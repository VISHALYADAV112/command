import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

let openSheetCount = 0

// Client-generated primary keys must be valid UUIDs — every remote table's
// id column is uuid typed, so no textual prefixes on persisted entities.
export function uid(_prefix?: string): string {
  return crypto.randomUUID()
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
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    openSheetCount += 1
    document.body.classList.add('sheet-open')
    closeRef.current?.focus()
    return () => {
      openSheetCount -= 1
      if (openSheetCount === 0) document.body.classList.remove('sheet-open')
      previous?.focus()
    }
  }, [])

  function keepFocusInside(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !sheetRef.current) return
    const controls = [...sheetRef.current.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )]
    if (controls.length === 0) return
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section ref={sheetRef} className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={keepFocusInside}>
        <header className="sheet-header">
          <div><span className="eyebrow">{eyebrow}</span><h2 id={titleId}>{title}</h2></div>
          <button ref={closeRef} className="icon-button sheet-close" type="button" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </header>
        {children}
      </section>
    </div>
  )
}

export function ConfirmSheet({
  title, detail, onConfirm, onClose,
  eyebrow = 'Confirm deletion', confirmLabel = 'Delete permanently',
}: {
  title: string
  detail: string
  onConfirm: () => void
  onClose: () => void
  eyebrow?: string
  confirmLabel?: string
}) {
  return (
    <Sheet title={title} eyebrow={eyebrow} onClose={onClose}>
      <div className="confirm-body">
        <p>{detail}</p>
        <div className="form-actions form-actions-split">
          <button className="secondary-button" type="button" onClick={onClose}>Keep it</button>
          <button className="danger-button" type="button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </Sheet>
  )
}

export function DoubleRule() {
  return <div className="double-rule" aria-hidden="true" />
}

export function ZoneHeading({ eyebrow, title, aside }: { eyebrow: string; title: string; aside?: ReactNode }) {
  return (
    <div className="zone-heading">
      <div>
        <span className="eyebrow"><GateMark />{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {aside && <div className="zone-aside">{aside}</div>}
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
