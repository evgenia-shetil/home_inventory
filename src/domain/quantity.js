export function parseQty(raw) {
  if (raw === null || raw === undefined) return 0
  // На телефоні десятковий роздільник часто кома, а не крапка.
  const value = Number(String(raw).replace(',', '.'))
  return Number.isFinite(value) ? value : 0
}

export function stepQty(raw, delta) {
  const next = Math.max(0, parseQty(raw) + delta)
  // Округлення до трьох знаків прибирає хвіст подвійної точності
  // (0.1 + 0.2 = 0.30000000000000004), не чіпаючи реальні дроби.
  return String(Math.round(next * 1000) / 1000)
}
