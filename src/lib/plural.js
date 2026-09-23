// Українська має три форми множини: 1 марка, 2-4 марки, 5+ марок.
// Числа 11-14 — виняток: попри останню цифру, вони беруть форму «багато».
export function plural(count, one, few, many) {
  const n = Math.abs(Math.trunc(count))
  const lastTwo = n % 100
  const last = n % 10

  if (lastTwo >= 11 && lastTwo <= 14) return many
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}
