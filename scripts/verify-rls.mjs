import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Немає VITE_SUPABASE_URL або VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const anon = createClient(url, key)
let failed = false

for (const table of ['categories', 'items', 'events']) {
  const { data, error } = await anon.from(table).select('*').limit(1)
  const rows = data?.length ?? 0
  if (rows > 0) {
    console.error(`ПРОВАЛ: ${table} віддає дані анонімному клієнту`)
    failed = true
  } else {
    console.log(`ok: ${table} — порожньо (${error ? error.code : 'без помилки'})`)
  }
}

process.exit(failed ? 1 : 0)
