import { useEffect, useId, useRef } from 'react'

// Нативні confirm() і prompt() виглядають чужими, не піддаються стилям
// і на телефоні зʼявляються як системне вікно браузера. Своє вікно
// дає однакову мову з рештою застосунку і місце для пояснення наслідків.
export default function Dialog({ title, description, confirmLabel = 'Підтвердити',
                                 tone = 'normal', onConfirm, onCancel }) {
  const box = useRef(null)
  const cancel = useRef(null)
  const confirm = useRef(null)
  const descriptionId = useId()

  useEffect(() => {
    // Руйнівна дія не отримує фокус першою: випадковий Enter чи подвійний
    // тап інакше видаляв би, не давши прочитати пояснення.
    const previous = document.activeElement
    ;(tone === 'danger' ? cancel : confirm).current?.focus()

    const onKey = e => {
      if (e.key === 'Escape') return onCancel()
      // Фокус не виходить за межі вікна: інакше Tab вів би на сторінку
      // позаду, яку не видно і з якою зараз не можна працювати.
      if (e.key !== 'Tab') return
      const focusable = box.current?.querySelectorAll('button:not(:disabled)')
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      // Після закриття фокус повертається туди, звідки вікно відкрили.
      if (previous instanceof HTMLElement && document.contains(previous)) previous.focus()
    }
  }, [onCancel, tone])

  return (
    <div className="dialog__backdrop" onClick={onCancel}>
      <div
        ref={box}
        className="dialog" role="dialog" aria-modal="true" aria-label={title}
        aria-describedby={description ? descriptionId : undefined}
        onClick={e => e.stopPropagation()}
      >
        <h2>{title}</h2>
        {description && <p className="muted" id={descriptionId}>{description}</p>}
        <div className="dialog__actions">
          <button ref={cancel} className="ghost" onClick={onCancel}>Скасувати</button>
          <button
            ref={confirm}
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
