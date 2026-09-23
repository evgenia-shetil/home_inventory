import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { lookupProduct } from '../domain/lookup.js'
import { normalizeBarcode } from '../domain/barcode.js'

const UNITS = ['шт', 'кг', 'г', 'л', 'мл', 'пачка', 'рулон']

export default function AddItemScreen() {
  const { categories, createItem, uploadPhoto } = useInventory()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const barcode = normalizeBarcode(params.get('barcode'))

  const [form, setForm] = useState({
    name: '', qty: '1', unit: 'шт', threshold: '1',
    category_id: '', last_price: '', last_place: '',
  })
  const [file, setFile] = useState(null)
  const [lookup, setLookup] = useState(barcode ? 'searching' : 'idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  // Пошук у відкритих базах за штрихкодом. Знахідка лише ПІДСТАВЛЯЄ значення —
  // усе лишається редагованим, бо назви там часто задовгі або чужою мовою.
  useEffect(() => {
    if (!barcode) return
    let cancelled = false

    ;(async () => {
      const found = await lookupProduct(barcode)
      if (cancelled) return

      if (!found) {
        setLookup('missing')
        return
      }

      setForm(f => ({ ...f, name: f.name || found.name }))
      setLookup('found')

      if (found.imageUrl) {
        try {
          const blob = await (await fetch(found.imageUrl)).blob()
          if (!cancelled) setFile(new File([blob], 'photo.jpg', { type: blob.type }))
        } catch {
          // Фото не критичне: назву ми вже підставили, решту додасть вручну.
        }
      }
    })()

    return () => { cancelled = true }
  }, [barcode])

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const item = await createItem({
        name: form.name.trim(),
        qty: Number(form.qty),
        unit: form.unit,
        threshold: Number(form.threshold),
        category_id: form.category_id || null,
        last_price: form.last_price === '' ? null : Number(form.last_price),
        last_place: form.last_place.trim() || null,
        barcode: barcode || null,
      })

      // Фото вантажиться окремо: невдача тут не має скасовувати
      // вже створений товар і втрачати заповнену форму.
      if (file) {
        try {
          await uploadPhoto(item.id, file)
        } catch {
          setError('Товар збережено, але фото не завантажилось. Додай його в картці.')
        }
      }

      navigate('/')
    } catch (err) {
      // 23505 — порушення унікальності: такий штрихкод уже за кимось закріплений.
      setError(err.code === '23505'
        ? 'Цей штрихкод уже привʼязаний до іншого товару'
        : err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack">
      <h1>Новий товар</h1>

      {barcode && (
        <p className="muted">
          Штрихкод {barcode}
          {lookup === 'searching' && ' · шукаю в каталогах…'}
          {lookup === 'found' && ' · знайдено, перевір назву'}
          {lookup === 'missing' && ' · у каталогах немає, впиши назву сама'}
        </p>
      )}

      {!barcode && (
        <Link to="/scan" className="linkline">Сканувати штрихкод замість ручного вводу</Link>
      )}

      <label className="field">
        Фото
        <input
          type="file" accept="image/*" capture="environment"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
        />
        {file && <span className="muted">Обрано: {file.name}</span>}
      </label>

      <label className="field">
        Назва
        <input required value={form.name} onChange={e => set('name', e.target.value)} />
      </label>

      <div className="row">
        <label className="field">
          Кількість
          <input type="number" inputMode="decimal" step="any" min="0"
                 required value={form.qty} onChange={e => set('qty', e.target.value)} />
        </label>
        <label className="field">
          Одиниця
          <select value={form.unit} onChange={e => set('unit', e.target.value)}>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
      </div>

      <label className="field">
        Поріг «закінчується»
        <input type="number" inputMode="decimal" step="any" min="0"
               value={form.threshold} onChange={e => set('threshold', e.target.value)} />
      </label>

      <label className="field">
        Категорія
        <select value={form.category_id} onChange={e => set('category_id', e.target.value)}>
          <option value="">без категорії</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      <div className="row">
        <label className="field">
          Ціна за одиницю
          <input type="number" inputMode="decimal" step="0.01" min="0"
                 value={form.last_price} onChange={e => set('last_price', e.target.value)} />
        </label>
        <label className="field">
          Де куплено
          <input value={form.last_place} onChange={e => set('last_place', e.target.value)} />
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={busy}>{busy ? 'Зберігаю…' : 'Зберегти'}</button>
      <button type="button" className="ghost" onClick={() => navigate('/')}>Скасувати</button>
    </form>
  )
}
