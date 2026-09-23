export function normalizeBarcode(raw) {
  if (!raw) return ''
  const digits = String(raw).replace(/\D/g, '')
  return digits
}

// Останній символ EAN/UPC — контрольна цифра, порахована з попередніх.
// Перевірка ловить помилку сканування ще до того, як ми підемо
// шукати неіснуючий товар у зовнішніх базах.
export function isValidBarcode(raw) {
  const code = normalizeBarcode(raw)
  if (![8, 12, 13, 14].includes(code.length)) return false

  const digits = code.split('').map(Number)
  const check = digits.pop()

  // Ваги 3 і 1 чергуються, рахуючи з кінця тіла коду.
  const sum = digits
    .reverse()
    .reduce((acc, digit, i) => acc + digit * (i % 2 === 0 ? 3 : 1), 0)

  return (10 - (sum % 10)) % 10 === check
}

export function findByBarcode(items, raw) {
  const code = normalizeBarcode(raw)
  if (!code) return null
  return items.find(item => normalizeBarcode(item.barcode) === code) ?? null
}
