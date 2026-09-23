import { isValidBarcode, normalizeBarcode } from './barcode.js'

// Порядок має значення: домашні запаси тут — переважно косметика й побутова
// хімія, тож спершу профільні бази, і лише потім харчова, найбільша з усіх.
const DATABASES = [
  'openbeautyfacts',
  'openproductsfacts',
  'openfoodfacts',
]

const endpoint = (db, code) =>
  `https://world.${db}.org/api/v2/product/${code}?fields=product_name,brands,image_url`

export function composeName(brands, productName) {
  const name = (productName ?? '').trim()
  if (!name) return ''

  const brand = (brands ?? '').split(',')[0].trim()
  if (!brand) return name
  if (name.toLowerCase().startsWith(brand.toLowerCase())) return name

  return `${brand} ${name}`
}

export async function lookupProduct(rawCode, fetchImpl = fetch) {
  const code = normalizeBarcode(rawCode)
  // Невалідний код — це майже завжди помилка сканування. Ходити з ним
  // у три бази поспіль означає змусити людину чекати даремно.
  if (!isValidBarcode(code)) return null

  for (const db of DATABASES) {
    try {
      const response = await fetchImpl(endpoint(db, code))
      if (!response.ok) continue

      const body = await response.json()
      if (body.status !== 1) continue

      const name = composeName(body.product?.brands, body.product?.product_name)
      if (!name) continue

      return { name, imageUrl: body.product?.image_url ?? null, source: db }
    } catch {
      // Одна недоступна база не має зривати пошук у решті.
      continue
    }
  }

  return null
}
