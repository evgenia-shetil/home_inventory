import { useEffect, useRef } from 'react'

// Нативні confirm() і prompt() виглядають чужими, не піддаються стилям
// і на телефоні зʼявляються як системне вікно браузера. Своє вікно
// дає однакову мову з рештою застосунку і місце для пояснення наслідків.
export default function Dialog({ title, description, confirmLabel = 'Підтвердити',
                                 tone = 'normal', onConfirm, onCancel }) {
  const ref = useRef(null)

  useEffect(() => {
    ref.current?.focus()
    const onKey = e => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="dialog__backdrop" onClick={onCancel}>
      <div
        className="dialog" role="dialog" aria-modal="true" aria-label={title}
        onClick={e => e.stopPropagation()}
      >
        <h2>{title}</h2>
        {description && <p className="muted">{description}</p>}
        <div className="dialog__actions">
          <button className="ghost" onClick={onCancel}>Скасувати</button>
          <button
            ref={ref}
            className={tone === 'danger' ? 'danger' : ''}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
