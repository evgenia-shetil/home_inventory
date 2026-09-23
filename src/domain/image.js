// Знімок з телефону важить 3-4 МБ. Для картки в сітці достатньо 100-150 КБ,
// тому зменшуємо до 1200 px по довшій стороні і зберігаємо як JPEG.
export async function compressImage(file, maxSide = 1200, quality = 0.75) {
  const bitmap = await createImageBitmap(file)

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise(resolve =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  )
  if (!blob) throw new Error('не вдалося стиснути зображення')
  return blob
}
