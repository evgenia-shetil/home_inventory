import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { applyDelta } from '../domain/optimistic.js'
import { compressImage } from '../domain/image.js'
import { invalidatePhoto } from '../lib/photos.js'

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

  const reload = useCallback(async () => {
    setStatus('loading')
    setError(null)

    const [itemsRes, catsRes] = await Promise.all([
      supabase.from('items').select('*'),
      supabase.from('categories').select('*').order('sort_order'),
    ])

    if (itemsRes.error || catsRes.error) {
      setError(itemsRes.error?.message ?? catsRes.error.message)
      setStatus('error')
      return
    }

    setItems(itemsRes.data.map(normalize))
    setCategories(catsRes.data)
    setStatus('ready')
  }, [])

  // Категорії за замовчуванням створюються ПЕРЕД читанням, а не паралельно:
  // інакше при першому вході список прочитається раніше, ніж заповниться.
  // Невдача не блокує застосунок — головна дія «−1» від категорій не залежить.
  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const { error } = await supabase.rpc('ensure_default_categories')
      if (error) console.warn('ensure_default_categories:', error.message)
      if (!cancelled) await reload()
    })()

    return () => { cancelled = true }
  }, [reload, userId])

  // Автоматична повторна спроба, коли мережа повернулась.
  useEffect(() => {
    if (online && status === 'error') reload()
  }, [online, status, reload])

  const notify = useCallback((text, options = {}) => {
    setNotice({ text, tone: options.tone ?? 'info', undo: options.undo ?? null, at: Date.now() })
  }, [])

  const dismissNotice = useCallback(() => setNotice(null), [])

  const adjust = useCallback(async (itemId, delta, kind, extra = {}) => {
    const { items: optimistic, applied } = applyDelta(items, itemId, delta)
    setItems(optimistic)

    const { data, error } = await supabase.rpc('adjust_quantity', {
      p_item_id: itemId,
      p_delta: delta,
      p_kind: kind,
      p_price: extra.price ?? null,
      p_place: extra.place ?? null,
    })

    if (error) {
      // Відкат зворотною зміною, а не поверненням до знімка:
      // інакше паралельний тап, що встиг пройти, був би затертий.
      setItems(current => applyDelta(current, itemId, -applied).items)
      setError(error.message)
      throw error
    }

    // Сервер — джерело правди: підставляємо його рядок цілком.
    setItems(current => current.map(i => (i.id === itemId ? normalize(data) : i)))
    return { row: data, applied }
  }, [items])

  // Будь-яка зміна кількості відкочується тим самим способом — зворотною
  // операцією з типом «виправлення». Раніше скасувати можна було лише
  // витрату, хоча помилитись легко і в поповненні, і в перерахунку.
  const adjustWithUndo = useCallback(async (itemId, delta, kind, extra = {}) => {
    const { row, applied } = await adjust(itemId, delta, kind, extra)
    const name = row?.name ?? ''
    const label = kind === 'consume'
      ? `Витрачено ${Math.abs(applied)} · ${name}`
      : kind === 'restock'
        ? `Додано ${applied} · ${name}`
        : `Виправлено на ${applied > 0 ? '+' : ''}${applied} · ${name}`

    if (applied !== 0) {
      notify(label, { undo: () => adjust(itemId, -applied, 'correction') })
    } else {
      notify('Кількість не змінилась')
    }
    return row
  }, [adjust, notify])

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

  const deleteItem = useCallback(async itemId => {
    const { error } = await supabase.from('items').delete().eq('id', itemId)
    if (error) throw error
    setItems(current => current.filter(i => i.id !== itemId))
  }, [])

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
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) throw error
    await Promise.all([reloadCategories(), reload()])
  }, [reloadCategories, reload])

  const value = {
    items, categories, status, error, online, notice,
    reload, adjust: adjustWithUndo, notify, dismissNotice,
    createItem, updateItem, deleteItem, uploadPhoto,
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
    threshold: Number(row.threshold),
    last_price: row.last_price === null ? null : Number(row.last_price),
  }
}
