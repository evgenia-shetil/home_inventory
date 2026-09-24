import { plural } from './plural.js'

const nf = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })
const cf = new Intl.NumberFormat('uk-UA', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// Скорочення (шт, мл, кг) не відмінюються, а повні слова — так:
// «3 рулон» читалось як помилка. Дробові беруть родовий однини:
// «1,5 рулону», «0,5 пачки».
const WORDS = {
  рулон: ['рулон', 'рулони', 'рулонів', 'рулону'],
  пачка: ['пачка', 'пачки', 'пачок', 'пачки'],
}

export function unitLabel(qty, unit) {
  const forms = WORDS[unit]
  if (!forms) return unit ?? ''
  const n = Number(qty)
  if (!Number.isInteger(n)) return forms[3]
  return plural(n, forms[0], forms[1], forms[2])
}

export function formatQty(qty, unit) {
  return `${nf.format(Number(qty))} ${unitLabel(qty, unit)}`.trim()
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
