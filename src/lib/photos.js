import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'

// Бакет приватний, тому прямого посилання на файл не існує:
// потрібен підписаний URL з обмеженим часом життя. Підписи кешуємо,
// інакше кожен рендер сітки робив би запит на кожну картку.
const TTL_SECONDS = 3600
const cache = new Map()

export async function getPhotoUrl(path) {
  if (!path) return null

  const hit = cache.get(path)
  // Хвилина запасу, щоб не віддати підпис, який протухне під час завантаження.
  if (hit && hit.expiresAt > Date.now() + 60_000) return hit.url

  const { data, error } = await supabase.storage
    .from('photos')
    .createSignedUrl(path, TTL_SECONDS)

  if (error) return null

  cache.set(path, { url: data.signedUrl, expiresAt: Date.now() + TTL_SECONDS * 1000 })
  return data.signedUrl
}

// Після перезавантаження фото шлях лишається тим самим,
// тому старий підпис треба викинути вручну.
export function invalidatePhoto(path) {
  cache.delete(path)
}

export function usePhotoUrl(path) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    getPhotoUrl(path).then(next => { if (!cancelled) setUrl(next) })
    return () => { cancelled = true }
  }, [path])

  return url
}
