import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import { plural } from '../lib/plural.js'
import { supabase } from '../lib/supabase.js'
import { applyDelta } from '../domain/optimistic.js'
import { compressImage } from '../domain/image.js'
import { invalidatePhoto } from '../lib/photos.js'
import { isNetworkError, applyQueue } from '../domain/offline.js'
import { loadSnapshot, saveSnapshot, loadQueue, saveQueue } from '../lib/offlineStore.js'

const InventoryContext = createContext(null)

export function useInventory() {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error('useInventory поза InventoryProvider')
  return ctx
}

export function InventoryProvider({ userId, children }) {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  // Єдиний канал зворотного звʼязку: будь-яка дія повідомляє про себе тут,
  // а ті, що можна відкотити, приносять із собою спосіб це зробити.
  const [notice, setNotice] = useState(null)
  const [online, setOnline] = useState(navigator.onLine)
  // Показано знімок із пристрою, а не свіжі дані з бази: момент знімка.
  const [staleSince, setStaleSince] = useState(null)
  // Операції, зроблені без мережі й ще не надіслані.
  const [pending, setPending] = useState(() => loadQueue(userId).length)

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  const notify = useCallback((text, options = {}) => {
    setNotice({
      text,
      tone: options.tone ?? 'info',
      undo: options.undo ?? null,
      actionLabel: options.actionLabel ?? null,
      at: Date.now(),
    })
  }, [])

  // quiet — без скелетона: коли на екрані вже є дані (знімок чи
  // попередня версія), миготіння порожнім екраном гірше за мить старих чисел.
  const reload = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setStatus('loading')
    setError(null)

    const [itemsRes, catsRes] = await Promise.all([
      supabase.from('items').select('*'),
      supabase.from('categories').select('*').order('sort_order'),
    ])

    if (itemsRes.error || catsRes.error) {
      const message = itemsRes.error?.message ?? catsRes.error.message
      setError(message)

      // Без мережі показуємо останній знімок із пристрою разом із
      // дотиками, які ще чекають на відправку. Помилка сервера знімком
      // не прикривається: вона означає поломку, яку треба бачити.
      const snapshot = isNetworkError(message, navigator.onLine) ? loadSnapshot(userId) : null
      if (snapshot) {
        setItems(applyQueue(snapshot.items.map(normalize), loadQueue(userId)))
        setCategories(snapshot.categories)
        setStaleSince(snapshot.at)
        setStatus('ready')
      } else {
        setStatus('error')
      }
      return
    }

    setItems(itemsRes.data.map(normalize))
    setCategories(catsRes.data)
    setStaleSince(null)
    setStatus('ready')
  }, [userId])

  // Знімок оновлюється лише зі свіжих даних і лише з порожньою чергою.
  // Числа на екрані вже містять відкладені дотики; якби вони потрапили
  // в знімок, при наступному відкритті черга наклалась би вдруге.
  useEffect(() => {
    if (status === 'ready' && !staleSince && !pending) saveSnapshot(userId, items, categories)
  }, [status, staleSince, pending, items, categories, userId])

  // Досилання відкладених операцій. Операція лишається в черзі, доки
  // сервер її не прийняв: втратити дотик гірше, ніж надіслати пізніше.
  // Єдиний виняток — товар, якого вже немає: повтор нічого не змінить.
  const flushing = useRef(false)
  const flushQueue = useCallback(async () => {
    if (flushing.current) return
    if (!loadQueue(userId).length) return

    const { data } = await supabase.auth.getSession()
    if (!data.session) return

    flushing.current = true
    let sent = 0
    let dropped = 0
    try {
      // Черга перечитується зі сховища на кожному кроці: поки йде
      // відправка, людина може скасувати відкладене або натиснути ще раз,
      // і власна копія черги затерла б ці зміни.
      for (;;) {
        const op = loadQueue(userId)[0]
        if (!op) break
        const { error } = await supabase.rpc('adjust_quantity', {
          p_item_id: op.itemId,
          p_delta: op.delta,
          p_kind: op.kind,
          p_price: op.extra?.price ?? null,
          p_place: op.extra?.place ?? null,
          p_bucket: op.extra?.bucket ?? 'stock',
        })
        if (error && !/товар не знайдено/.test(error.message)) break
        if (error) dropped += 1
        else sent += 1
        const rest = loadQueue(userId).filter(o => o.id !== op.id)
        saveQueue(userId, rest)
        setPending(rest.length)
      }
    } finally {
      flushing.current = false
    }
    const left = loadQueue(userId).length

    if (sent) notify(`Надіслано ${sent} ${plural(sent, 'операцію', 'операції', 'операцій')}, зроблених без мережі`, { tone: 'success' })
    if (dropped) notify(`${dropped} ${plural(dropped, 'операцію', 'операції', 'операцій')} не надіслано: товар видалено`, { tone: 'error' })
    if (left) notify('Частину операцій не надіслано. Повтор — після наступного підключення', { tone: 'error' })
  }, [userId, notify])

  // Категорії за замовчуванням створюються ПЕРЕД читанням, а не паралельно:
  // інакше при першому вході список прочитається раніше, ніж заповниться.
  // Невдача не блокує застосунок — головна дія «−1» від категорій не залежить.
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const { error } = await supabase.rpc('ensure_default_categories')
      if (error) console.warn('ensure_default_categories:', error.message)
      await flushQueue()
      if (!cancelled) await reload()
    })()

    return () => { cancelled = true }
  }, [reload, flushQueue, userId])

  // Повторюємо лише на переході «мережі не було → зʼявилась». Умова
  // без цього переходу зациклювалась: помилка вмикала повтор, повтор
  // давав помилку, і запити йшли безперервно.
  const wasOnline = useRef(online)
  useEffect(() => {
    const cameBack = online && !wasOnline.current
    wasOnline.current = online
    if (!cameBack) return
    if (status === 'error' || staleSince || pending) {
      flushQueue().then(() => reload({ quiet: status === 'ready' }))
    }
  }, [online, status, staleSince, pending, reload, flushQueue])

  const sync = useCallback(
    () => flushQueue().then(() => reload({ quiet: true })),
    [flushQueue, reload])

  // Сигнал «мережа зʼявилась» ненадійний: у магазині телефон буває
  // «онлайн» без робочого звʼязку. Тому ще одна спроба — щоразу, коли
  // застосунок повертається на екран.
  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && (staleSince || pending)) sync()
    }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [staleSince, pending, sync])

  const dismissNotice = useCallback(() => setNotice(null), [])

  // Операції над одним товаром шикуються в чергу: інакше два швидкі тапи
  // читають той самий стан «до», і фактична зміна другого виходить удвічі
  // більшою, а скасування повертає зайве.
  const queues = useRef(new Map())

  const runQueued = useCallback((itemId, task) => {
    const previous = queues.current.get(itemId) ?? Promise.resolve()
    const next = previous.catch(() => {}).then(task)
    queues.current.set(itemId, next)
    next.catch(() => {}).finally(() => {
      if (queues.current.get(itemId) === next) queues.current.delete(itemId)
    })
    return next
  }, [])

  const adjustOnce = useCallback(async (itemId, delta, kind, extra = {}) => {
    // Оптимістично міняємо лише запас у шафі: перенесення й списання
    // з користування сервер порахує сам, а розбіжність тут коштувала б
    // дорожче за мить очікування.
    const bucket = extra.bucket ?? 'stock'
    const before = items.find(i => i.id === itemId)
    const optimisticDelta = bucket === 'stock' ? delta : 0
    const { items: optimistic, applied: guessed } = applyDelta(items, itemId, optimisticDelta)
    setItems(optimistic)

    // Без мережі запит навіть не відправляємо: у магазині зі слабким
    // сигналом він висів би до тайм-ауту, а дотик має спрацьовувати одразу.
    const { data, error } = navigator.onLine
      ? await supabase.rpc('adjust_quantity', {
          p_item_id: itemId,
          p_delta: delta,
          p_kind: kind,
          p_price: extra.price ?? null,
          p_place: extra.place ?? null,
          p_bucket: bucket,
        })
      : { data: null, error: { message: 'offline' } }

    if (error && isNetworkError(error, navigator.onLine)) {
      const op = { id: crypto.randomUUID(), itemId, delta, kind, extra: { ...extra, bucket }, at: new Date().toISOString() }
      const queue = [...loadQueue(userId), op]
      if (saveQueue(userId, queue)) {
        setPending(queue.length)
        const row = optimistic.find(i => i.id === itemId) ?? before
        return { row, applied: guessed, queued: op.id }
      }
    }

    if (error) {
      // Відкат зворотною зміною, а не поверненням до знімка:
      // інакше паралельний тап, що встиг пройти, був би затертий.
      setItems(current => applyDelta(current, itemId, -guessed).items)
      setError(error.message)
      throw error
    }

    // Сервер — джерело правди: підставляємо його рядок цілком.
    setItems(current => current.map(i => (i.id === itemId ? normalize(data) : i)))

    // Фактична зміна рахується з відповіді сервера, а не з того, що
    // просили: він обмежує нулем і не переносить більше, ніж є в шафі.
    const applied = bucket === 'stock'
      ? Number(data.qty) - Number(before?.qty ?? 0)
      : Number(data.in_use) - Number(before?.in_use ?? 0)

    return { row: data, applied }
  }, [items, userId])

  // Скасування відкладеної операції — просто прибрати її з черги
  // і повернути число на екрані: на сервер вона ще не потрапила.
  const unqueue = useCallback((opId, itemId, applied) => {
    const queue = loadQueue(userId)
    const next = queue.filter(op => op.id !== opId)
    if (next.length === queue.length) {
      throw new Error('Операцію вже надіслано. Скасування — через картку товару')
    }
    saveQueue(userId, next)
    setPending(next.length)
    setItems(current => applyDelta(current, itemId, -applied).items)
  }, [userId])

  const adjust = useCallback(
    (itemId, delta, kind, extra) =>
      runQueued(itemId, () => adjustOnce(itemId, delta, kind, extra)),
    [runQueued, adjustOnce])

  // Будь-яка зміна кількості відкочується тим самим способом — зворотною
  // операцією з типом «виправлення». Раніше скасувати можна було лише
  // витрату, хоча помилитись легко і в поповненні, і в перерахунку.
  const adjustWithUndo = useCallback(async (itemId, delta, kind, extra = {}) => {
    const bucket = extra.bucket ?? 'stock'
    const { row, applied, queued } = await adjust(itemId, delta, kind, extra)
    const name = row?.name ?? ''

    if (queued) {
      notify(`Збережено на пристрої · ${name}. Буде надіслано після підключення`, {
        undo: () => unqueue(queued, itemId, applied),
      })
      return row
    }

    const label =
      kind === 'open'
        ? (applied > 0 ? `У користуванні · ${name}` : `Повернуто у шафу · ${name}`)
      : kind === 'restock' ? `Додано ${applied} · ${name}`
      : kind === 'correction' ? `Виправлено на ${applied > 0 ? '+' : ''}${applied} · ${name}`
      : kind === 'discard' ? `Списано ${Math.abs(applied)} · ${name}`
      : bucket === 'in_use' ? `Скінчилось · ${name}`
      : `Витрачено ${Math.abs(applied)} · ${name}`

    if (applied !== 0) {
      // Відкат тим самим лічильником: інакше перенесене в користування
      // поверталось би не туди, звідки його взяли.
      notify(label, {
        undo: () => adjust(itemId, -applied,
          kind === 'open' ? 'open' : 'correction', { bucket }),
      })
    } else {
      notify('Нічого не змінилось')
    }
    return row
  }, [adjust, notify, unqueue])

  // Списання зіпсованого забирає річ цілком — і з шафи, і з користування,
  // бо дата одна на рядок. Дві операції, але одне повідомлення й одне
  // скасування: інакше друге повідомлення затерло б відкат першого.
  const discard = useCallback(async itemId => {
    const item = items.find(i => i.id === itemId)
    if (!item) return
    const done = []
    for (const [bucket, amount] of [['stock', item.qty], ['in_use', item.in_use]]) {
      if (Number(amount) <= 0) continue
      const { applied, row } = await adjust(itemId, -Number(amount), 'discard', { bucket })
      done.push({ bucket, applied, row })
    }
    if (!done.length) return notify('Нічого не змінилось')

    const total = done.reduce((sum, d) => sum + Math.abs(d.applied), 0)
    notify(`Списано ${total} · ${item.name}`, {
      undo: async () => {
        for (const d of done) await adjust(itemId, -d.applied, 'correction', { bucket: d.bucket })
      },
    })
  }, [items, adjust, notify])

  // Переведення з мілілітрів в упаковки — окрема серверна функція: це
  // не дельта, а зміна одиниці, і кількість повз журнал не міняється.
  const convertToPacks = useCallback(async (itemId, packSize) => {
    const { data, error } = await supabase.rpc('convert_to_packs', {
      p_item_id: itemId,
      p_pack_size: packSize,
    })
    if (error) throw error
    setItems(current => current.map(i => (i.id === itemId ? normalize(data) : i)))
    return normalize(data)
  }, [])

  // Головна дія застосунку. Спершу закінчується те, що вже відкрите,
  // і лише потім береться запас із шафи. Одна реалізація на всі екрани.
  const consume = useCallback(itemId => {
    const target = items.find(i => i.id === itemId)
    const bucket = Number(target?.in_use ?? 0) > 0 ? 'in_use' : 'stock'
    return adjustWithUndo(itemId, -1, 'consume', { bucket })
      .catch(err => notify(err.message, { tone: 'error' }))
  }, [items, adjustWithUndo, notify])

  const createItem = useCallback(async fields => {
    const { data, error } = await supabase
      .from('items')
      .insert({ ...fields, user_id: userId })
      .select()
      .single()
    if (error) throw error
    const item = normalize(data)
    setItems(current => [...current, item])
    return item
  }, [userId])

  const updateItem = useCallback(async (itemId, fields) => {
    const { data, error } = await supabase
      .from('items').update(fields).eq('id', itemId).select().single()
    if (error) throw error
    setItems(current => current.map(i => (i.id === itemId ? normalize(data) : i)))
    return data
  }, [])

  // Фото лежить у сховищі окремо від рядка: база його не каскадує,
  // тож без цього кроку файли накопичувались би назавжди.
  const removePhotoFile = useCallback(async path => {
    if (!path) return
    await supabase.storage.from('photos').remove([path])
    invalidatePhoto(path)
  }, [])

  const deleteItem = useCallback(async itemId => {
    const photoPath = items.find(i => i.id === itemId)?.photo_path
    const { error } = await supabase.from('items').delete().eq('id', itemId)
    if (error) throw error
    setItems(current => current.filter(i => i.id !== itemId))
    // Файл прибираємо після рядка: якщо не вдасться, товар усе одно видалений.
    removePhotoFile(photoPath).catch(() => {})
  }, [items, removePhotoFile])

  const deletePhoto = useCallback(async itemId => {
    const item = items.find(i => i.id === itemId)
    if (!item?.photo_path) return
    await removePhotoFile(item.photo_path)
    await updateItem(itemId, { photo_path: null })
  }, [items, removePhotoFile, updateItem])

  const uploadPhoto = useCallback(async (itemId, file) => {
    const blob = await compressImage(file)
    const path = `${userId}/${itemId}.jpg`
    const { error } = await supabase.storage
      .from('photos')
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
    if (error) throw error

    invalidatePhoto(path)
    await updateItem(itemId, { photo_path: path })
    return path
  }, [userId, updateItem])

  const reloadCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('categories').select('*').order('sort_order')
    if (error) throw error
    setCategories(data)
  }, [])

  // Повертає створений рядок: форма додавання одразу обирає нову
  // категорію, щоб не переривати введення товару.
  const createCategory = useCallback(async (name, parentId = null) => {
    const { data, error } = await supabase.from('categories').insert({
      user_id: userId,
      name: name.trim(),
      parent_id: parentId,
      // В кінець списку: нові категорії не мають перемішувати звичний порядок.
      sort_order: 999,
    }).select().single()
    if (error) throw error
    await reloadCategories()
    return data
  }, [userId, reloadCategories])

  const updateCategory = useCallback(async (id, fields) => {
    const { error } = await supabase.from('categories').update(fields).eq('id', id)
    if (error) throw error
    await reloadCategories()
  }, [reloadCategories])

  // Видалення батька забирає й дітей (cascade), а товари з цих категорій
  // лишаються без категорії, але не зникають (items.category_id set null).
  const deleteCategory = useCallback(async id => {
    const gone = new Set([id, ...categories.filter(c => c.parent_id === id).map(c => c.id)])
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) throw error

    await reloadCategories()
    // Товари не перечитуємо з сервера: відомо рівно те, що змінилось,
    // а повне перезавантаження блимало скелетонами на весь екран.
    setItems(current => current.map(i =>
      gone.has(i.category_id) ? { ...i, category_id: null } : i))
  }, [categories, reloadCategories])

  // Заміна за графіком: стара річ списується з користування, нова
  // переноситься з шафи, дата заміни стає сьогоднішньою. Кілька операцій,
  // але одне повідомлення й одне скасування — як у списанні.
  const replace = useCallback(async (categoryId, today) => {
    const category = categories.find(c => c.id === categoryId)
    if (!category) return
    const group = items.filter(i => i.category_id === categoryId)
    const done = []

    const old = group.find(i => Number(i.in_use) > 0)
    if (old) {
      const { applied } = await adjust(old.id, -1, 'consume', { bucket: 'in_use' })
      done.push({ id: old.id, applied, kind: 'correction', bucket: 'in_use' })
    }
    // Нову беремо тієї ж марки, якщо вона є в шафі: звичку не міняємо.
    const fresh = group.find(i => i.id === old?.id && Number(i.qty) > 0) ?? group.find(i => Number(i.qty) > 0)
    if (fresh) {
      const { applied } = await adjust(fresh.id, 1, 'open', { bucket: 'move' })
      done.push({ id: fresh.id, applied, kind: 'open', bucket: 'move' })
    }

    const previous = category.replaced_on ?? null
    await updateCategory(categoryId, { replaced_on: today })

    notify(fresh ? `Замінено · ${category.name}` : `Замінено · ${category.name}. У шафі порожньо`, {
      tone: fresh ? 'info' : 'error',
      undo: async () => {
        for (const d of [...done].reverse()) await adjust(d.id, -d.applied, d.kind, { bucket: d.bucket })
        await updateCategory(categoryId, { replaced_on: previous })
      },
    })
  }, [categories, items, adjust, updateCategory, notify])

  const value = {
    items, categories, status, error, online, notice, staleSince, pending,
    reload, sync, adjust: adjustWithUndo, notify, dismissNotice,
    consume, discard, convertToPacks, replace,
    createItem, updateItem, deleteItem, uploadPhoto, deletePhoto,
    createCategory, updateCategory, deleteCategory,
  }

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

// Postgres numeric приїздить рядком, щоб не втратити точність.
// Для арифметики в інтерфейсі приводимо до числа в одному місці.
function normalize(row) {
  return {
    ...row,
    qty: Number(row.qty),
    in_use: Number(row.in_use ?? 0),
    threshold: Number(row.threshold),
    last_price: row.last_price === null ? null : Number(row.last_price),
    pack_size: row.pack_size === null || row.pack_size === undefined ? null : Number(row.pack_size),
  }
}
