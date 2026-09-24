// Service worker тримає оболонку застосунку на пристрої, щоб він
// відкривався без мережі — у магазині, де звʼязку часто немає.
// Дані тут не кешуються: знімок обліку й черга живуть у самому
// застосунку (src/lib/offlineStore.js), а запити до Supabase йдуть повз.
//
// Файл лежить поза збіркою й не має хешу в назві, тож стратегії обрані
// так, щоб він НЕ МІГ застрягти на старій версії:
// - сторінка — спершу мережа, кеш лише як запасний шлях;
// - version.json — завжди мережа, інакше UpdateWatcher осліп би;
// - зібрані файли мають хеш у назві й не змінюються — кеш назавжди.
const SHELL = 'zapasy-shell-v1'
const ASSETS = 'zapasy-assets-v1'
const FONTS = 'zapasy-fonts-v1'
const KNOWN = [SHELL, ASSETS, FONTS]
const MAX_ASSETS = 60
const NAV_TIMEOUT = 4000

const BASE = new URL('./', self.location).pathname

// ignoreVary обовʼязковий: модульні скрипти запитуються з заголовком
// Origin, а сервер відповідає «Vary: Origin». Без цього збережена при
// встановленні копія не збігалась би з запитом сторінки, і без мережі
// застосунок відкривався б порожнім екраном.
const MATCH = { ignoreVary: true }

self.addEventListener('install', event => {
  event.waitUntil(precache().catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter(n => !KNOWN.includes(n)).map(n => caches.delete(n)))
    await self.clients.claim()
  })())
})

// Під час першого відвідування сторінка вже завантажилась до того, як
// працівник почав діяти. Тому файли, на які посилається index.html,
// кладуться в кеш одразу, а не лише при наступному відкритті.
async function precache() {
  const response = await fetch(BASE, { cache: 'no-store' })
  if (!response.ok) return
  const shell = await caches.open(SHELL)
  await shell.put(BASE, response.clone())

  const html = await response.text()
  const urls = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map(m => m[1])
  const assets = await caches.open(ASSETS)
  await assets.addAll(urls)
  await shell.addAll([`${BASE}manifest.webmanifest`, `${BASE}icon-192.png`])
}

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.origin === self.location.origin) {
    if (!url.pathname.startsWith(BASE)) return
    if (url.pathname.endsWith('/version.json') || url.pathname.endsWith('/sw.js')) return

    if (request.mode === 'navigate') {
      event.respondWith(networkFirst(request))
    } else if (url.pathname.startsWith(`${BASE}assets/`)) {
      event.respondWith(cacheFirst(request))
    } else {
      event.respondWith(staleWhileRevalidate(request, SHELL))
    }
    return
  }

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, FONTS))
  }
  // Supabase, каталоги товарів і фото — завжди мережа.
})

// Уся навігація в HashRouter — це одна сторінка, тож і ключ у кеші один.
async function networkFirst(request) {
  const cache = await caches.open(SHELL)
  try {
    const response = await withTimeout(fetch(request), NAV_TIMEOUT)
    if (response.ok) await cache.put(BASE, response.clone())
    return response
  } catch {
    return (await cache.match(BASE, MATCH)) ?? Response.error()
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS)
  const hit = await cache.match(request, MATCH)
  if (hit) return hit

  const response = await fetch(request)
  if (response.ok) {
    await cache.put(request, response.clone())
    trim(cache)
  }
  return response
}

async function staleWhileRevalidate(request, name) {
  const cache = await caches.open(name)
  const hit = await cache.match(request, MATCH)
  const fresh = fetch(request)
    .then(response => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone())
      return response
    })
    .catch(() => hit ?? Response.error())
  return hit ?? fresh
}

// Кожен деплой приносить нові файли з новими хешами, старі більше не
// потрібні. Ключі в кеші лежать у порядку додавання — видаляємо найдавніші.
async function trim(cache) {
  const keys = await cache.keys()
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) {
    await cache.delete(key)
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then(
      value => { clearTimeout(timer); resolve(value) },
      error => { clearTimeout(timer); reject(error) },
    )
  })
}
