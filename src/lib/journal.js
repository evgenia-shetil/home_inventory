import { useEffect, useState } from 'react'
import { supabase } from './supabase.js'
import { useInventory } from '../data/InventoryContext.jsx'

const PAGE = 1000
const FIELDS = 'item_id,delta,kind,bucket,price,place,created_at'

// Журнал за останні місяці для всіх товарів: з нього рахуються і
// порівняння цін, і прогноз витрачання. Старіші записи не потрібні —
// давня ціна й давній темп нічого не кажуть про сьогодні.
export function useJournal(days = 180) {
  const { items } = useInventory()
  const [state, setState] = useState({ events: null, error: null })

  // Перечитуємо, коли сервер підтвердив зміну (updated_at), а не коли
  // змінилось число на екрані: оптимістичне оновлення приходить раніше,
  // ніж подія потрапляє в журнал.
  const version = items.reduce(
    (latest, i) => (String(i.updated_at) > latest ? String(i.updated_at) : latest), '')

  useEffect(() => {
    let cancelled = false
    const since = new Date(Date.now() - days * 86_400_000).toISOString()

    ;(async () => {
      const rows = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('events').select(FIELDS)
          .gte('created_at', since)
          .order('created_at', { ascending: true })
          .range(from, from + PAGE - 1)
        if (cancelled) return
        if (error) return setState({ events: null, error: error.message })
        rows.push(...data)
        if (data.length < PAGE) break
      }
      setState({ events: rows, error: null })
    })()

    return () => { cancelled = true }
  }, [days, version])

  return state
}
