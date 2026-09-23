import { useEffect } from 'react'
import { useInventory } from '../data/InventoryContext.jsx'
import { hasNewerBuild } from '../lib/version.js'

// Перевіряємо при відкритті й щоразу, коли застосунок повертається на
// передній план: саме тоді людина ним і користується.
export default function UpdateWatcher() {
  const { notify } = useInventory()

  useEffect(() => {
    let stopped = false

    async function check() {
      if (stopped) return
      if (await hasNewerBuild()) {
        notify('Доступна нова версія', {
          actionLabel: 'Оновити',
          // Просте перезавантаження може знову взяти сторінку з кешу —
          // саме через нього застосунок і застряг на старій версії.
          // Разовий параметр в адресі змушує завантажити її наново.
          undo: () => {
            const { origin, pathname, hash } = window.location
            window.location.replace(`${origin}${pathname}?v=${Date.now()}${hash}`)
          },
        })
      }
    }

    // Перевірка при відкритті — беззастережна. Умова про видимість
    // стосується лише повернення на передній план: перевіряти в момент
    // згортання застосунку немає сенсу.
    const onVisible = () => { if (!document.hidden) check() }

    check()
    document.addEventListener('visibilitychange', onVisible)
    return () => { stopped = true; document.removeEventListener('visibilitychange', onVisible) }
  }, [notify])

  return null
}
