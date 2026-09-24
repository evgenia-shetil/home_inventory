import { stepQty, parseQty } from '../domain/quantity.js'
import { unitLabel } from '../lib/format.js'

// Поле кількості зі стрілками. На телефоні влучити в кнопку легше,
// ніж у вузьке текстове поле й дрібні нативні стрілки браузера.
// onCommit — необовʼязковий: спрацьовує, коли значення вже остаточне
// (натиснута стрілка або поле втратило фокус), а не на кожну літеру.
export default function QtyInput({ value, onChange, onCommit, min = 0, unit }) {
  const step = delta => {
    const next = stepQty(value, delta)
    onChange(next)
    onCommit?.(next)
  }

  return (
    <div className="qtyinput">
      <button
        type="button" className="qtyinput__btn"
        onClick={() => step(-1)}
        disabled={Number(String(value).replace(',', '.')) <= min}
        aria-label="Зменшити на одиницю"
      >
        −
      </button>

      <input
        className="qtyinput__field"
        type="text" inputMode="decimal" value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={e => onCommit?.(e.target.value)}
        aria-label="Кількість"
      />

      {unit && <span className="qtyinput__unit">{unitLabel(parseQty(value), unit)}</span>}

      <button
        type="button" className="qtyinput__btn"
        onClick={() => step(1)}
        aria-label="Збільшити на одиницю"
      >
        +
      </button>
    </div>
  )
}
