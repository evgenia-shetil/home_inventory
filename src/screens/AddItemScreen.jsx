import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { lookupProduct } from '../domain/lookup.js'
import { normalizeBarcode } from '../domain/barcode.js'
import { suggestCategory } from '../domain/suggest.js'
import { collectPlaces } from '../domain/places.js'
import { parseQty } from '../domain/quantity.js'
import QtyInput from '../ui/QtyInput.jsx'
import CategorySelect from '../ui/CategorySelect.jsx'
import PlaceInput from '../ui/PlaceInput.jsx'

const UNITS = ['шт', 'кг', 'г', 'л', 'мл', 'пачка', 'рулон']
const MEASURES = ['мл', 'л', 'г', 'кг']

const PHOTO_NOTE = {
  loading: 'фото завантажується…',
  ready: 'фото взято з каталогу',
  none: 'у каталозі немає фото',
  failed: 'фото не завантажилось',
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
    pack_size: '', pack_unit: 'мл', expires_on: '',
  })
  const [file, setFile] = useState(null)
  const [photoState, setPhotoState] = useState('idle')
  const [lookup, setLookup] = useState(barcode ? 'searching' : 'idle')
  // Щойно категорію обрали руками, підказка більше не втручається.
  const [categoryTouched, setCategoryTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [next, setNext] = useState('home')
  const [error, setError] = useState(null)

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  // Прийшли з екрана категорії — вона вже обрана, і підказка не втручається.
  // Застосовується РІВНО ОДИН РАЗ: масив categories отримує нову
  // ідентичність при кожному перезавантаженні списку, і без цього
  // прапорця ефект скидав щойно обрану вручну категорію.
  const presetApplied = useRef(false)
  useEffect(() => {
    if (presetApplied.current || !presetCategory || !categories.length) return
    const target = categories.find(c => c.id === presetCategory)
    if (!target) return

    presetApplied.current = true
    setCategoryTouched(true)
    setForm(f => ({
      ...f,
      rootId: target.parent_id ?? target.id,
      childId: target.parent_id ? target.id : '',
    }))
  }, [presetCategory, categories])

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
        // Фасування описує упаковку, тож має сенс лише для штучного обліку.
        ...(!MEASURES.includes(form.unit) && parseQty(form.pack_size) > 0
          ? { pack_size: parseQty(form.pack_size), pack_unit: form.pack_unit }
          : {}),
        ...(form.expires_on ? { expires_on: form.expires_on } : {}),
      })

      if (file) {
        try {
          await uploadPhoto(item.id, file)
        } catch {
          setError('Товар збережено. Фото не завантажилось — його можна додати в картці.')
        }
      }

      navigate(next === 'scan' ? '/scan' : '/', { replace: true })
    } catch (err) {
      setError(err.code === '23505'
        ? 'Штрихкод уже привʼязаний до іншого товару'
        : err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack">
      <button type="button" className="back" onClick={() => navigate(-1)}>← назад</button>
      <h1>Новий товар</h1>

      {barcode && (
        <p className="muted">
          Штрихкод {barcode}
          {lookup === 'searching' && ' · пошук у каталогах…'}
          {lookup === 'found' && ' · знайдено'}
          {lookup === 'missing' && ' · у каталогах немає'}
          {PHOTO_NOTE[photoState] && ` · ${PHOTO_NOTE[photoState]}`}
        </p>
      )}

      {!barcode && (
        <Link to="/scan" className="linkline">Сканування штрихкоду</Link>
      )}

      <label className="field">
        Фото
        <span className="filepick">
          {file ? file.name : 'Обрати фото'}
          <input
            type="file" accept="image/*" capture="environment" hidden
            onChange={e => { setFile(e.target.files?.[0] ?? null); setPhotoState('idle') }}
          />
        </span>
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

      {!MEASURES.includes(form.unit) && (
        <div className="field">
          Фасування, необовʼязково
          <div className="row row--fit">
            <input type="text" inputMode="decimal" placeholder="Обʼєм однієї упаковки"
                   value={form.pack_size} onChange={e => set('pack_size', e.target.value)}
                   aria-label="Обʼєм однієї упаковки" />
            <select value={form.pack_unit} onChange={e => set('pack_unit', e.target.value)}
                    aria-label="Одиниця фасування">
              {MEASURES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
      )}

      <label className="field">
        Придатний до, необовʼязково
        <input type="date" value={form.expires_on} onChange={e => set('expires_on', e.target.value)} />
      </label>

      <label className="field">
        Категорія
        <CategorySelect
          value={form.rootId}
          onChange={id => {
            setCategoryTouched(true)
            setForm(f => ({ ...f, rootId: id, childId: '' }))
          }}
        />
      </label>

      <label className="field">
        Підкатегорія
        <CategorySelect
          value={form.childId}
          parentId={form.rootId || null}
          disabled={!form.rootId}
          emptyLabel={form.rootId ? 'не обрано' : 'спочатку категорія'}
          onChange={id => { setCategoryTouched(true); set('childId', id) }}
        />
      </label>

      <div className="row">
        <label className="field">
          Ціна за одиницю
          <input type="number" inputMode="decimal" step="0.01" min="0"
                 value={form.last_price} onChange={e => set('last_price', e.target.value)} />
        </label>
        <label className="field">
          Де куплено
          <PlaceInput value={form.last_place} places={places} onChange={v => set('last_place', v)} />
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={busy} onClick={() => setNext('home')}>
        {busy ? 'Збереження…' : 'Зберегти'}
      </button>

      {/* Запаси заводяться пачками: повернення на головну після кожного
          товару змушує щоразу шукати кнопку сканера заново. */}
      <button type="submit" className="ghost" disabled={busy} onClick={() => setNext('scan')}>
        Зберегти і сканувати далі
      </button>

      <button type="button" className="ghost" onClick={() => navigate(-1)}>Скасувати</button>
    </form>
  )
}
