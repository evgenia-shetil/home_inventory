import { stepQty } from '../domain/quantity.js'

// Поле кількості зі стрілками. На телефоні влучити в кнопку легше,
// ніж у вузьке текстове поле й дрібні нативні стрілки браузера.
export default function QtyInput({ value, onChange, min = 0, unit }) {
  const step = delta => onChange(stepQty(value, delta))

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
        aria-label="Кількість"
      />

      {unit && <span className="qtyinput__unit">{unit}</span>}

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
