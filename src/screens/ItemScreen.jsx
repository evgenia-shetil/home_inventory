import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { usePhotoUrl } from '../lib/photos.js'
import { useInventory } from '../data/InventoryContext.jsx'
import { formatQty, formatPrice } from '../lib/format.js'
import { collectPlaces } from '../domain/places.js'
import { parseQty, correctionDelta } from '../domain/quantity.js'
import QtyInput from '../ui/QtyInput.jsx'
import PlaceInput from '../ui/PlaceInput.jsx'
import CategorySelect from '../ui/CategorySelect.jsx'

const UNITS = ['шт', 'кг', 'г', 'л', 'мл', 'пачка', 'рулон']
const KIND_LABEL = { consume: 'витрата', restock: 'поповнення', correction: 'виправлення' }

export default function ItemScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items, categories, adjust, deleteItem, uploadPhoto, updateItem } = useInventory()
  const item = items.find(i => i.id === id)
  const places = collectPlaces(items)

  const [events, setEvents] = useState([])
  const [name, setName] = useState('')
  const [restock, setRestock] = useState({ qty: '1', price: '', place: '' })
  const [recount, setRecount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [note, setNote] = useState(null)

  const photoUrl = usePhotoUrl(item?.photo_path)

  useEffect(() => { if (item) setName(item.name) }, [item?.id, item?.name])
  useEffect(() => { if (item) setRecount(String(item.qty)) }, [item?.id, item?.qty])

  useEffect(() => {
    let cancelled = false
    supabase
      .from('events').select('*').eq('item_id', id)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { if (!cancelled) setEvents(data ?? []) })
    return () => { cancelled = true }
    // updated_at ставить сервер — його поява означає, що подія вже в базі.
  }, [id, item?.updated_at])

  if (!item) return <p className="muted">Товар не знайдено.</p>

  const current = categories.find(c => c.id === item.category_id)
  const rootId = current ? (current.parent_id ?? current.id) : ''
  const childId = current?.parent_id ? current.id : ''

  const flash = message => {
    setNote(message)
    setTimeout(() => setNote(null), 2500)
  }

  const save = (fields, message) =>
    updateItem(item.id, fields)
      .then(() => { setError(null); if (message) flash(message) })
      .catch(err => setError(err.message))

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
      flash('Поповнено')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Перерахунок полиці: у журнал іде саме зміна, а не підсумок,
  // тому історія лишається правдивою — видно, що було виправлення.
  async function handleRecount(e) {
    e.preventDefault()
    const delta = correctionDelta(item.qty, recount)
    if (delta === 0) return flash('Кількість не змінилась')

    setBusy(true)
    setError(null)
    try {
      await adjust(item.id, delta, 'correction')
      flash(`Виправлено на ${delta > 0 ? '+' : ''}${delta}`)
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
      <button className="back" onClick={() => navigate(-1)}>← назад</button>

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

      <label className="field">
        Назва
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => {
            const next = name.trim()
            if (next && next !== item.name) save({ name: next }, 'Назву збережено')
            else setName(item.name)
          }}
        />
      </label>

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

      {note && <p className="muted">{note}</p>}
      {error && <p className="error">{error}</p>}

      <dl className="facts">
        <dt>Ціна за одиницю</dt><dd>{formatPrice(item.last_price)}</dd>
        <dt>Де куплено</dt><dd>{item.last_place ?? '—'}</dd>
        <dt>Категорія</dt><dd>{current?.name ?? 'без категорії'}</dd>
        <dt>Штрихкод</dt>
        <dd>
          {item.barcode
            ? item.barcode
            : <Link to={`/scan?attach=${item.id}`} className="linkline">привʼязати</Link>}
        </dd>
      </dl>

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
        <button type="submit" disabled={busy}>{busy ? 'Зберігаю…' : 'Поповнити'}</button>
      </form>

      {/* Другорядне сховане за розкриттям: щодня потрібні лише «−1»
          і поповнення, решта — зрідка й навмисно. */}
      <details className="edit">
        <summary>Виправити й налаштувати</summary>
        <div className="stack">
          <form onSubmit={handleRecount} className="stack">
            <p className="muted">
              Порахувала полицю й число не збіглось — впиши, скільки насправді.
              У журналі зʼявиться виправлення.
            </p>
            <QtyInput value={recount} onChange={setRecount} unit={item.unit} />
            <button type="submit" className="ghost" disabled={busy}>Виправити кількість</button>
          </form>

          <div className="row">
            <div className="field">
              Категорія
              <CategorySelect
                value={rootId}
                onChange={cat => save({ category_id: cat || null })}
              />
            </div>
            <div className="field">
              Підкатегорія
              <CategorySelect
                value={childId}
                parentId={rootId || null}
                disabled={!rootId}
                emptyLabel={rootId ? 'не обрано' : 'спершу обери категорію'}
                onChange={cat => save({ category_id: cat || rootId || null })}
              />
            </div>
          </div>

          <label className="field">
            Одиниця виміру
            <select value={item.unit} onChange={e => save({ unit: e.target.value }, 'Одиницю змінено')}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>

          <button type="button" className="danger" onClick={handleDelete}>Видалити товар</button>
        </div>
      </details>

      <h2>Історія</h2>
      {events.length === 0
        ? <p className="muted">Операцій ще не було.</p>
        : <ul className="history">
            {events.map(e => (
              <li key={e.id}>
                <span>{Number(e.delta) > 0 ? `+${e.delta}` : e.delta}</span>
                <span className="muted">
                  {KIND_LABEL[e.kind]}
                  {e.price !== null && e.price !== undefined && ` · ${formatPrice(e.price)}`}
                  {e.place && ` · ${e.place}`}
                </span>
                <span className="muted">
                  {new Date(e.created_at).toLocaleDateString('uk-UA', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>}
    </div>
  )
}
