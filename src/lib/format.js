const nf = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })
const cf = new Intl.NumberFormat('uk-UA', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatQty(qty, unit) {
  return `${nf.format(Number(qty))} ${unit}`.trim()
}

export function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '—'
  return `${cf.format(Number(value))} грн`
}

export function formatTotal(qty, price) {
  if (price === null || price === undefined || price === '') return '—'
  return formatPrice(Number(qty) * Number(price))
}

// Число окремо від одиниці: у списку запасів цифра є змістом,
// а «шт» — підписом, і вони не мають важити однаково.
export function formatNumber(value) {
  return nf.format(Number(value))
}
