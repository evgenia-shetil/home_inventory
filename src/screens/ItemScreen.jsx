import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { usePhotoUrl } from '../lib/photos.js'
import { useInventory } from '../data/InventoryContext.jsx'
import { formatQty, formatPrice } from '../lib/format.js'
import { collectPlaces } from '../domain/places.js'
import { parseQty } from '../domain/quantity.js'
import QtyInput from '../ui/QtyInput.jsx'
import CategorySelect from '../ui/CategorySelect.jsx'
import PlaceInput from '../ui/PlaceInput.jsx'

const KIND_LABEL = { consume: 'витрата', restock: 'поповнення', correction: 'виправлення' }

export default function ItemScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items, categories, adjust, deleteItem, uploadPhoto, updateItem } = useInventory()
  const item = items.find(i => i.id === id)
  const places = collectPlaces(items)
  const current = categories.find(c => c.id === item?.category_id)
  // Обрана гілка: якщо товар у підкатегорії — показуємо і її батька.
  const rootId = current ? (current.parent_id ?? current.id) : ''
  const childId = current?.parent_id ? current.id : ''

  const setCategory = (root, child) =>
    updateItem(item.id, { category_id: child || root || null })
      .catch(err => setError(err.message))

  const [events, setEvents] = useState([])
  const [restock, setRestock] = useState({ qty: '1', price: '', place: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const photoUrl = usePhotoUrl(item?.photo_path)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('events').select('*').eq('item_id', id)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { if (!cancelled) setEvents(data ?? []) })
    return () => { cancelled = true }
    // Залежність саме від updated_at, а не від qty: кількість змінюється
    // оптимістично ще до запиту, тож перезавантаження історії стартувало б
    // раніше, ніж подія потрапить у базу. updated_at ставить сервер,
    // тому його поява — надійна ознака, що запис уже там.
  }, [id, item?.updated_at])

  if (!item) return <p className="muted">Товар не знайдено.</p>

  async function handleRestock(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await adjust(item.id, parseQty(restock.qty), 'restock', {
        price: restock.price === '' ? null : Number(restock.price),
        place: restock.place.trim() || null,
      })
      setRestock({ qty: '1', price: '', place: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Видалити «${item.name}»? Журнал операцій теж зникне.`)) return
    await deleteItem(item.id)
    navigate('/')
  }

  return (
    <div className="stack">
      <button className="ghost" onClick={() => navigate(-1)}>← Назад</button>

      {photoUrl
        ? <img src={photoUrl} alt="" className="hero" />
        : <label className="hero hero--empty">
            Додати фото
            <input type="file" accept="image/*" capture="environment" hidden
                   onChange={e => {
                     const f = e.target.files?.[0]
                     if (f) uploadPhoto(item.id, f).catch(err => setError(err.message))
                   }} />
          </label>}

      <h1>{item.name}</h1>
      <div className="qtyrow">
        <p className="card__qty">{formatQty(item.qty, item.unit)}</p>
        <button
          className="consume"
          disabled={item.qty <= 0 || busy}
          onClick={() => adjust(item.id, -1, 'consume').catch(err => setError(err.message))}
        >
          −1
        </button>
      </div>

      <dl className="facts">
        <dt>Ціна за одиницю</dt><dd>{formatPrice(item.last_price)}</dd>
        <dt>Де куплено</dt><dd>{item.last_place ?? '—'}</dd>
        <dt>Штрихкод</dt>
        <dd>
          {item.barcode
            ? item.barcode
            : <Link to={`/scan?attach=${item.id}`} className="linkline">привʼязати</Link>}
        </dd>
      </dl>

      <h2>Категорія</h2>
      <div className="row">
        <div className="field">
          Категорія
          <CategorySelect value={rootId} onChange={id => setCategory(id, '')} />
        </div>
        <div className="field">
          Підкатегорія
          <CategorySelect
            value={childId}
            parentId={rootId || null}
            disabled={!rootId}
            emptyLabel={rootId ? 'не обрано' : 'спершу обери категорію'}
            onChange={id => setCategory(rootId, id)}
          />
        </div>
      </div>

      <form onSubmit={handleRestock} className="stack">
        <h2>Поповнити</h2>
        <div className="field">
          Скільки додати
          <QtyInput
            value={restock.qty}
            unit={item.unit}
            onChange={v => setRestock(r => ({ ...r, qty: v }))}
          />
        </div>
        <div className="row">
          <label className="field">
            Нова ціна
            <input type="number" inputMode="decimal" step="0.01" min="0"
                   value={restock.price}
                   onChange={e => setRestock(r => ({ ...r, price: e.target.value }))} />
          </label>
          <div className="field">
            Де куплено
            <PlaceInput
              value={restock.place}
              places={places}
              onChange={v => setRestock(r => ({ ...r, place: v }))}
            />
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Зберігаю…' : 'Поповнити'}</button>
      </form>

      <h2>Історія</h2>
      {events.length === 0
        ? <p className="muted">Операцій ще не було.</p>
        : <ul className="history">
            {events.map(e => (
              <li key={e.id}>
                <span>{Number(e.delta) > 0 ? `+${e.delta}` : e.delta}</span>
                <span className="muted">{KIND_LABEL[e.kind]}</span>
                <span className="muted">
                  {new Date(e.created_at).toLocaleDateString('uk-UA', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>}

      <button className="ghost" onClick={handleDelete}>Видалити товар</button>
    </div>
  )
}
