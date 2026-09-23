import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { usePhotoUrl } from '../lib/photos.js'
import { useInventory } from '../data/InventoryContext.jsx'
import { formatQty, formatPrice, formatTotal } from '../lib/format.js'

const KIND_LABEL = { consume: 'витрата', restock: 'поповнення', correction: 'виправлення' }

export default function ItemScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items, adjust, deleteItem, uploadPhoto } = useInventory()
  const item = items.find(i => i.id === id)

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
  }, [id, item?.qty])

  if (!item) return <p className="muted">Товар не знайдено.</p>

  async function handleRestock(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await adjust(item.id, Number(restock.qty), 'restock', {
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
      <p className="card__qty">{formatQty(item.qty, item.unit)}</p>

      <dl className="facts">
        <dt>Ціна за одиницю</dt><dd>{formatPrice(item.last_price)}</dd>
        <dt>Вартість залишку</dt><dd>{formatTotal(item.qty, item.last_price)}</dd>
        <dt>Де куплено</dt><dd>{item.last_place ?? '—'}</dd>
        <dt>Поріг</dt><dd>{formatQty(item.threshold, item.unit)}</dd>
      </dl>

      <form onSubmit={handleRestock} className="stack">
        <h2>Поповнити</h2>
        <div className="row">
          <label className="field">
            Скільки додати
            <input type="number" inputMode="decimal" step="any" min="0.01" required
                   value={restock.qty}
                   onChange={e => setRestock(r => ({ ...r, qty: e.target.value }))} />
          </label>
          <label className="field">
            Нова ціна
            <input type="number" inputMode="decimal" step="0.01" min="0"
                   value={restock.price}
                   onChange={e => setRestock(r => ({ ...r, price: e.target.value }))} />
          </label>
        </div>
        <label className="field">
          Де куплено
          <input value={restock.place}
                 onChange={e => setRestock(r => ({ ...r, place: e.target.value }))} />
        </label>
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
