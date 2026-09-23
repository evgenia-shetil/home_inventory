import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { lookupProduct } from '../domain/lookup.js'
import { normalizeBarcode } from '../domain/barcode.js'
import { suggestCategory } from '../domain/suggest.js'
import { collectPlaces } from '../domain/places.js'
import { parseQty } from '../domain/quantity.js'
import QtyInput from '../ui/QtyInput.jsx'
import PlaceInput from '../ui/PlaceInput.jsx'

const UNITS = ['шт', 'кг', 'г', 'л', 'мл', 'пачка', 'рулон']

const PHOTO_NOTE = {
  loading: 'фото завантажується з каталогу…',
  ready: 'фото взято з каталогу',
  none: 'у каталозі немає фото — зніми сама',
  failed: 'фото з каталогу не завантажилось — зніми сама',
}

export default function AddItemScreen() {
  const { categories, items, createItem, uploadPhoto } = useInventory()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const barcode = normalizeBarcode(params.get('barcode'))
  const presetCategory = params.get('category')

  const [form, setForm] = useState({
    name: '', qty: '1', unit: 'шт',
    rootId: '', childId: '', last_price: '', last_place: '',
  })
  const [file, setFile] = useState(null)
  const [photoState, setPhotoState] = useState('idle')
  const [lookup, setLookup] = useState(barcode ? 'searching' : 'idle')
  // Щойно категорію обрали руками, підказка більше не втручається.
  const [categoryTouched, setCategoryTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  // Прийшли з екрана категорії — вона вже обрана, і підказка не втручається.
  useEffect(() => {
    if (!presetCategory || !categories.length) return
    const target = categories.find(c => c.id === presetCategory)
    if (!target) return
    setCategoryTouched(true)
    setForm(f => ({
      ...f,
      rootId: target.parent_id ?? target.id,
      childId: target.parent_id ? target.id : '',
    }))
  }, [presetCategory, categories])

  const roots = categories.filter(c => !c.parent_id)
  const children = categories.filter(c => c.parent_id === form.rootId)
  const places = collectPlaces(items)

  function applySuggestion(name) {
    if (categoryTouched) return
    const { rootId, childId } = suggestCategory(name, categories)
    if (rootId) setForm(f => ({ ...f, rootId, childId: childId ?? '' }))
  }

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

      setLookup('found')
      setForm(f => (f.name ? f : { ...f, name: found.name }))
      applySuggestion(found.name)

      if (!found.imageUrl) {
        setPhotoState('none')
        return
      }

      setPhotoState('loading')
      try {
        const response = await fetch(found.imageUrl)
        if (!response.ok) throw new Error(String(response.status))
        const blob = await response.blob()
        if (cancelled) return
        setFile(new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' }))
        setPhotoState('ready')
      } catch {
        // Раніше ця помилка ковталась мовчки, і «немає фото в каталозі»
        // було не відрізнити від «фото є, але не завантажилось».
        if (!cancelled) setPhotoState('failed')
      }
    })()

    return () => { cancelled = true }
  }, [barcode, categories.length])

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const item = await createItem({
        name: form.name.trim(),
        qty: parseQty(form.qty),
        unit: form.unit,
        // Поріг живе на категорії; у товарі лишається запасний для позакатегорійних.
        threshold: 1,
        // Товар прив'язується до найточнішої обраної гілки.
        category_id: form.childId || form.rootId || null,
        last_price: form.last_price === '' ? null : Number(form.last_price),
        last_place: form.last_place.trim() || null,
        barcode: barcode || null,
      })

      if (file) {
        try {
          await uploadPhoto(item.id, file)
        } catch {
          setError('Товар збережено, але фото не завантажилось. Додай його в картці.')
        }
      }

      navigate('/')
    } catch (err) {
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
          {PHOTO_NOTE[photoState] && ` · ${PHOTO_NOTE[photoState]}`}
        </p>
      )}

      {!barcode && (
        <Link to="/scan" className="linkline">Сканувати штрихкод замість ручного вводу</Link>
      )}

      <label className="field">
        Фото
        <input
          type="file" accept="image/*" capture="environment"
          onChange={e => { setFile(e.target.files?.[0] ?? null); setPhotoState('idle') }}
        />
        {file && <span className="muted">Обрано: {file.name}</span>}
      </label>

      <label className="field">
        Назва
        <input
          required value={form.name}
          onChange={e => set('name', e.target.value)}
          onBlur={e => applySuggestion(e.target.value)}
        />
      </label>

      <div className="field">
        Кількість
        <QtyInput value={form.qty} onChange={v => set('qty', v)} unit={form.unit} />
      </div>

      <label className="field">
        Одиниця
        <select value={form.unit} onChange={e => set('unit', e.target.value)}>
          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </label>

      <div className="row">
        <label className="field">
          Категорія
          <select
            value={form.rootId}
            onChange={e => {
              setCategoryTouched(true)
              setForm(f => ({ ...f, rootId: e.target.value, childId: '' }))
            }}
          >
            <option value="">без категорії</option>
            {roots.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <label className="field">
          Підкатегорія
          <select
            value={form.childId}
            disabled={!children.length}
            onChange={e => { setCategoryTouched(true); set('childId', e.target.value) }}
          >
            <option value="">{children.length ? 'не обрано' : '—'}</option>
            {children.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>

      <div className="row">
        <label className="field">
          Ціна за одиницю
          <input type="number" inputMode="decimal" step="0.01" min="0"
                 value={form.last_price} onChange={e => set('last_price', e.target.value)} />
        </label>
        <div className="field">
          Де куплено
          <PlaceInput value={form.last_place} places={places} onChange={v => set('last_place', v)} />
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={busy}>{busy ? 'Зберігаю…' : 'Зберегти'}</button>
      <button type="button" className="ghost" onClick={() => navigate('/')}>Скасувати</button>
    </form>
  )
}
