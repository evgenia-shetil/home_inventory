// Порожній сірий прямокутник займав пів картки й не повідомляв нічого.
// Літера з кольором, виведеним із назви, дає впізнаваність без фото.
export function hue(name = '') {
  let sum = 0
  for (const ch of name) sum = (sum + ch.codePointAt(0) * 7) % 360
  return sum
}
