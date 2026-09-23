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
import Dialog from '../ui/Dialog.jsx'
import { IconTrash } from '../ui/icons.jsx'

const UNITS = ['шт', 'кг', 'г', 'л', 'мл', 'пачка', 'рулон']
const KIND_LABEL = {
  consume: 'витрата', restock: 'поповнення',
  correction: 'виправлення', open: 'взято в користування',
}

export default function ItemScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items, categories, adjust, deleteItem, uploadPhoto, updateItem, notify } = useInventory()
  const item = items.find(i => i.id === id)
  const places = collectPlaces(items)

  const [events, setEvents] = useState([])
  const [name, setName] = useState('')
  const [restock, setRestock] = useState({ qty: '1', price: '', place: '' })
  const [recount, setRecount] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

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

  if (!item) {
    return (
      <div className="stack">
        <h1>Товар не знайдено</h1>
        <p className="muted">Схоже, його видалили або посилання застаріло.</p>
        <Link to="/"><button>До запасів</button></Link>
      </div>
    )
  }

  const inUse = Number(item.in_use ?? 0)
  const current = categories.find(c => c.id === item.category_id)
  const rootId = current ? (current.parent_id ?? current.id) : ''
  const childId = current?.parent_id ? current.id : ''

  const save = (fields, message) =>
    updateItem(item.id, fields)
      .then(() => { if (message) notify(message) })
      .catch(err => notify(err.message, { tone: 'error' }))

  async function handleRestock(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await adjust(item.id, parseQty(restock.qty), 'restock', {
        price: restock.price === '' ? null : Number(restock.price),
        place: restock.place.trim() || null,
      })
      setRestock({ qty: '1', price: '', place: '' })
    } catch (err) {
      notify(err.message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  // Перерахунок полиці: у журнал іде саме зміна, а не підсумок,
  // тому історія лишається правдивою — видно, що було виправлення.
  async function handleRecount(e) {
    e.preventDefault()
    const delta = correctionDelta(item.qty, recount)
    if (delta === 0) return notify('Кількість не змінилась')

    setBusy(true)
    try {
      await adjust(item.id, delta, 'correction')
    } catch (err) {
      notify(err.message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setConfirmDelete(false)
    try {
      await deleteItem(item.id)
      notify(`Видалено «${item.name}»`)
      navigate('/')
    } catch (err) {
      notify(err.message, { tone: 'error' })
    }
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
                     if (f) uploadPhoto(item.id, f)
                       .then(() => notify('Фото додано'))
                       .catch(err => notify(err.message, { tone: 'error' }))
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
        <p className="card__qty">{formatQty(item.qty + inUse, item.unit)}</p>
        <button
          className="consume"
          disabled={item.qty + inUse <= 0 || busy}
          onClick={() => adjust(item.id, -1, 'consume',
            { bucket: inUse > 0 ? 'in_use' : 'stock' })
            .catch(err => notify(err.message, { tone: 'error' }))}
        >
          −1
        </button>
      </div>

      <div className="usebar">
        <span>У шафі {formatQty(item.qty, item.unit)}</span>
        <span>·</span>
        <span>У користуванні {formatQty(inUse, item.unit)}</span>
      </div>

      {/* Перенесення з шафи у ванну не є витратою: сума не міняється,
          тож сигнал «час купувати» не спрацює передчасно. */}
      <button
        type="button" className="ghost" disabled={item.qty <= 0 || busy}
        onClick={() => adjust(item.id, 1, 'open', { bucket: 'move' })
          .catch(err => notify(err.message, { tone: 'error' }))}
      >
        Взяти одну в користування
      </button>

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

          <button type="button" className="danger" onClick={() => setConfirmDelete(true)}>
            <IconTrash /> Видалити товар
          </button>
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
                  {KIND_LABEL[e.kind] ?? e.kind}
                  {e.bucket === 'in_use' && ' (з ванної)'}
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
      {confirmDelete && (
        <Dialog
          title={`Видалити «${item.name}»?`}
          description="Разом із товаром зникне весь його журнал операцій і привʼязаний штрихкод. Якщо річ просто скінчилась, краще лишити її з нулем — тоді історія та штрихкод збережуться."
          confirmLabel="Видалити"
          tone="danger"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
