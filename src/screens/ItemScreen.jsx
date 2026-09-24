import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { usePhotoUrl } from '../lib/photos.js'
import { useInventory } from '../data/InventoryContext.jsx'
import { formatQty, formatPrice } from '../lib/format.js'
import { collectPlaces } from '../domain/places.js'
import { pricesByPlace } from '../domain/prices.js'
import { expiryState, describeExpiry, mergeExpiry } from '../domain/expiry.js'
import { parseQty, correctionDelta } from '../domain/quantity.js'
import QtyInput from '../ui/QtyInput.jsx'
import PlaceInput from '../ui/PlaceInput.jsx'
import CategorySelect from '../ui/CategorySelect.jsx'
import Dialog from '../ui/Dialog.jsx'
import { IconTrash } from '../ui/icons.jsx'

const UNITS = ['шт', 'кг', 'г', 'л', 'мл', 'пачка', 'рулон']
// Міри обʼєму й ваги: запас у них рахується не упаковками, а вмістом.
const MEASURES = ['мл', 'л', 'г', 'кг']
const KIND_LABEL = {
  consume: 'витрата', restock: 'поповнення',
  correction: 'виправлення', open: 'взято в користування',
  discard: 'списано зіпсоване', unit: 'зміна одиниці',
}

const longDate = iso =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })

const shortDate = iso =>
  new Date(iso).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })

export default function ItemScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const {
    items, categories, adjust, deleteItem, uploadPhoto, deletePhoto, updateItem, notify,
    discard, convertToPacks,
  } = useInventory()
  const item = items.find(i => i.id === id)
  const places = collectPlaces(items)

  const [events, setEvents] = useState([])
  const [name, setName] = useState('')
  const [restock, setRestock] = useState({ qty: '1', price: '', place: '', expires: '' })
  const [packSize, setPackSize] = useState('')
  const [packUnit, setPackUnit] = useState('мл')
  const [expiresDraft, setExpiresDraft] = useState('')
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [confirmConvert, setConfirmConvert] = useState(false)
  const [recount, setRecount] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const photoUrl = usePhotoUrl(item?.photo_path)

  useEffect(() => { if (item) setName(item.name) }, [item?.id, item?.name])
  useEffect(() => { if (item) setRecount(String(item.qty)) }, [item?.id, item?.qty])
  useEffect(() => { if (item) setPackSize(item.pack_size ? String(item.pack_size) : '') }, [item?.id, item?.pack_size])
  useEffect(() => { if (item) setPackUnit(item.pack_unit ?? 'мл') }, [item?.id, item?.pack_unit])
  useEffect(() => { if (item) setExpiresDraft(item.expires_on ?? '') }, [item?.id, item?.expires_on])

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
        <p className="muted">Товар видалено або посилання застаріло.</p>
        <Link to="/"><button>До запасів</button></Link>
      </div>
    )
  }

  const inUse = Number(item.in_use ?? 0)
  const expiry = expiryState(item)
  const isMeasure = MEASURES.includes(item.unit)
  const prices = pricesByPlace(events)
  // Таблиця потрібна, лише коли є що порівнювати: один магазин з однією
  // ціною вже видно в «Ціна за одиницю».
  const showPrices = prices.length > 1 || prices.some(p => p.count > 1 && p.min !== p.price)
  const current = categories.find(c => c.id === item.category_id)
  const rootId = current ? (current.parent_id ?? current.id) : ''
  const childId = current?.parent_id ? current.id : ''

  const save = (fields, message, tone = 'info') =>
    updateItem(item.id, fields)
      .then(() => { if (message) notify(message, { tone }) })
      .catch(err => notify(err.message, { tone: 'error' }))

  async function handleRestock(e) {
    e.preventDefault()
    setBusy(true)
    const stockBefore = item.qty + inUse
    try {
      await adjust(item.id, parseQty(restock.qty), 'restock', {
        price: restock.price === '' ? null : Number(restock.price),
        place: restock.place.trim() || null,
      })
      // Дата нової упаковки не має затерти ближчу дату тієї, що вже стоїть.
      const nextExpiry = mergeExpiry(item.expires_on, restock.expires, stockBefore)
      if (nextExpiry !== (item.expires_on ?? null)) {
        await updateItem(item.id, { expires_on: nextExpiry })
      }
      setRestock({ qty: '1', price: '', place: '', expires: '' })
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

  function savePack(rawSize, unit) {
    const size = rawSize.trim() === '' ? null : parseQty(rawSize)
    const next = size && size > 0 ? { pack_size: size, pack_unit: unit } : { pack_size: null, pack_unit: null }
    if (next.pack_size === (item.pack_size ?? null) && next.pack_unit === (item.pack_unit ?? null)) return
    save(next, next.pack_size ? 'Фасування збережено' : 'Фасування прибрано', 'success')
  }

  async function handleDiscard() {
    setConfirmDiscard(false)
    try {
      await discard(item.id)
      // Дата стосувалась списаних упаковок; наступне поповнення принесе свою.
      await updateItem(item.id, { expires_on: null })
    } catch (err) {
      notify(err.message, { tone: 'error' })
    }
  }

  async function handleConvert() {
    setConfirmConvert(false)
    try {
      const row = await convertToPacks(item.id, parseQty(packSize))
      notify(`Рахується упаковками: ${formatQty(row.qty + row.in_use, row.unit)}`, { tone: 'success' })
    } catch (err) {
      notify(err.message, { tone: 'error' })
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
        : <div className="hero hero--empty" aria-hidden="true">Фото немає</div>}

      {/* Без capture система сама пропонує камеру або бібліотеку —
          раніше вибір із галереї був неможливий. */}
      <div className="photoactions">
        <label className="ghost photoactions__pick">
          {photoUrl ? 'Замінити фото' : 'Додати фото'}
          <input type="file" accept="image/*" hidden
                 onChange={e => {
                   const f = e.target.files?.[0]
                   if (!f) return
                   uploadPhoto(item.id, f)
                     .then(() => notify('Фото збережено', { tone: 'success' }))
                     .catch(err => notify(err.message, { tone: 'error' }))
                 }} />
        </label>

        {photoUrl && (
          <button type="button" className="link link--danger" onClick={() =>
            deletePhoto(item.id)
              .then(() => notify('Фото видалено', { tone: 'success' }))
              .catch(err => notify(err.message, { tone: 'error' }))
          }>
            Видалити фото
          </button>
        )}
      </div>

      <label className="field">
        Назва
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => {
            const next = name.trim()
            if (next && next !== item.name) save({ name: next }, 'Назву збережено', 'success')
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

      {expiry?.state === 'expired' && (
        <div className="alert">
          <p>Термін придатності минув {longDate(item.expires_on)}. У запас не рахується.</p>
          <button type="button" className="ghost" onClick={() => setConfirmDiscard(true)}>
            Списати
          </button>
        </div>
      )}

      {/* Перенесення між шафою і користуванням не є витратою: сума не
          міняється, тож сигнал «час купувати» не спрацює передчасно. */}
      <div className="row">
        <button
          type="button" className="ghost" disabled={item.qty <= 0 || busy}
          onClick={() => adjust(item.id, 1, 'open', { bucket: 'move' })
            .catch(err => notify(err.message, { tone: 'error' }))}
        >
          У користування
        </button>
        <button
          type="button" className="ghost" disabled={inUse <= 0 || busy}
          onClick={() => adjust(item.id, -1, 'open', { bucket: 'move' })
            .catch(err => notify(err.message, { tone: 'error' }))}
        >
          Повернути у шафу
        </button>
      </div>

      <dl className="facts">
        <dt>Ціна за одиницю</dt><dd>{formatPrice(item.last_price)}</dd>
        <dt>Де куплено</dt><dd>{item.last_place ?? '—'}</dd>
        <dt>Категорія</dt><dd>{current?.name ?? 'без категорії'}</dd>
        {item.pack_size && (
          <><dt>Фасування</dt><dd>{formatQty(item.pack_size, item.pack_unit)}</dd></>
        )}
        <dt>Придатний до</dt>
        <dd className={expiry && expiry.state !== 'ok' ? 'expiry--warn' : ''}>
          {item.expires_on
            ? <>{longDate(item.expires_on)}{expiry && expiry.state !== 'ok' && <small>{describeExpiry(expiry)}</small>}</>
            : '—'}
        </dd>
        <dt>Штрихкод</dt>
        <dd>
          {item.barcode
            ? item.barcode
            : <Link to={`/scan?attach=${item.id}`} className="linkline">Привʼязати</Link>}
        </dd>
      </dl>

      {showPrices && (
        <section>
          <h2>Ціни за магазинами</h2>
          <table className="prices">
            <thead>
              <tr><th>Магазин</th><th>Остання</th><th>Найнижча</th></tr>
            </thead>
            <tbody>
              {prices.map(p => (
                <tr key={p.place ?? ''}>
                  <td>
                    {p.place ?? <span className="muted">не вказано</span>}
                    <small className="muted">{shortDate(p.at)}</small>
                  </td>
                  <td className="num">{formatPrice(p.price)}</td>
                  <td className="num muted">{p.min === p.price ? '—' : formatPrice(p.min)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

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
        <label className="field">
          Придатний до
          <input type="date" value={restock.expires}
                 onChange={e => setRestock(r => ({ ...r, expires: e.target.value }))} />
        </label>
        <button type="submit" disabled={busy}>{busy ? 'Збереження…' : 'Поповнити'}</button>
      </form>

      {/* Другорядне сховане за розкриттям: щодня потрібні лише «−1»
          і поповнення, решта — зрідка й навмисно. */}
      <details className="edit">
        <summary>Налаштування товару</summary>
        <div className="stack">
          <form onSubmit={handleRecount} className="stack">
            <p className="muted">
              Фактична кількість, якщо вона відрізняється від обліку.
              У журналі буде записано виправлення.
            </p>
            <QtyInput value={recount} onChange={setRecount} unit={item.unit} />
            <button type="submit" className="ghost" disabled={busy}>Змінити кількість</button>
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
                emptyLabel={rootId ? 'не обрано' : 'спочатку категорія'}
                onChange={cat => save({ category_id: cat || rootId || null })}
              />
            </div>
          </div>

          <div className="field">
            Термін придатності
            <div className="row row--fit">
              {/* Зберігаємо після завершення введення, а не на кожну зміну:
                  на компʼютері рік набирається по цифрі, і кожен проміжний
                  «0002 рік» інакше потрапляв би в базу. */}
              <input
                type="date"
                value={expiresDraft}
                onChange={e => setExpiresDraft(e.target.value)}
                onBlur={() => {
                  const next = expiresDraft || null
                  if (next !== (item.expires_on ?? null)) save({ expires_on: next }, 'Термін збережено', 'success')
                }}
              />
              {item.expires_on && (
                <button type="button" className="ghost ghost--fit"
                        onClick={() => save({ expires_on: null }, 'Термін прибрано', 'success')}>
                  Прибрати
                </button>
              )}
            </div>
            <small className="muted">
              Одна дата на товар — найближча серед наявних упаковок.
            </small>
          </div>

          {isMeasure
            ? <div className="field">
                Рахувати упаковками
                <small className="muted">
                  Зараз запас рахується в {item.unit}. Упаковками рахувати простіше:
                  різні фасування тоді складаються чесно, а обʼєм лишається описом.
                </small>
                <div className="row row--fit">
                  <input type="text" inputMode="decimal" placeholder={`Обʼєм упаковки, ${item.unit}`}
                         value={packSize} onChange={e => setPackSize(e.target.value)}
                         aria-label={`Обʼєм однієї упаковки, ${item.unit}`} />
                  <button type="button" className="ghost ghost--fit"
                          disabled={parseQty(packSize) <= 0}
                          onClick={() => setConfirmConvert(true)}>
                    Перевести
                  </button>
                </div>
              </div>
            : <div className="field">
                Фасування
                <div className="row row--fit">
                  <input type="text" inputMode="decimal" placeholder="Обʼєм однієї упаковки"
                         value={packSize}
                         onChange={e => setPackSize(e.target.value)}
                         onBlur={() => savePack(packSize, packUnit)}
                         aria-label="Обʼєм однієї упаковки" />
                  <select value={packUnit} aria-label="Одиниця фасування"
                          onChange={e => { setPackUnit(e.target.value); savePack(packSize, e.target.value) }}>
                    {MEASURES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <small className="muted">
                  Опис упаковки. Дозволяє порівнювати ціни різних фасувань.
                </small>
              </div>}

          <label className="switch">
            <input
              type="checkbox"
              checked={item.recurring !== false}
              onChange={e => save({ recurring: e.target.checked },
                e.target.checked ? 'Потрапляє до списку покупок' : 'Виключено зі списку покупок')}
            />
            <span>
              Поповнювати після витрачання
              <small className="muted">
                Вимкнено — товар лишається в запасах, але не потрапляє до списку покупок
              </small>
            </span>
          </label>

          <label className="field">
            Одиниця виміру
            <select value={item.unit} onChange={e => save({ unit: e.target.value }, 'Одиницю змінено', 'success')}>
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
        ? <p className="muted">Операцій немає.</p>
        : <ul className="history">
            {events.map(e => (
              <li key={e.id}>
                <span>{e.kind === 'unit' ? '⇄' : Number(e.delta) > 0 ? `+${e.delta}` : e.delta}</span>
                <span className="muted">
                  {KIND_LABEL[e.kind] ?? e.kind}
                  {e.note && `: ${e.note}`}
                  {e.bucket === 'in_use' && ' (з користування)'}
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
      {confirmDiscard && (
        <Dialog
          title={`Списати «${item.name}»?`}
          description={`Буде списано ${formatQty(item.qty + inUse, item.unit)} і прибрано дату. У журналі це записується як списання, а не витрата, тож на прогноз витрачання не впливає.`}
          confirmLabel="Списати"
          tone="danger"
          onConfirm={handleDiscard}
          onCancel={() => setConfirmDiscard(false)}
        />
      )}
      {confirmConvert && (
        <Dialog
          title="Рахувати упаковками?"
          description={[
            `${formatQty(item.qty + inUse, item.unit)} стане ${formatQty(Math.round((item.qty + inUse) / parseQty(packSize) * 1000) / 1000, 'шт')} по ${formatQty(parseQty(packSize), item.unit)}.`,
            item.last_price !== null ? `Ціна за одиницю стане ціною за упаковку: ${formatPrice(item.last_price * parseQty(packSize))}.` : null,
            current?.parent_id ? `Сигнал підкатегорії «${current.name}» задається в тих самих одиницях, що й товари, — після переведення його варто перевірити.` : null,
            'Зміна записується в журнал. Повернути назад можна лише вручну.',
          ].filter(Boolean).join(' ')}
          confirmLabel="Перевести"
          onConfirm={handleConvert}
          onCancel={() => setConfirmConvert(false)}
        />
      )}
      {confirmDelete && (
        <Dialog
          title={`Видалити «${item.name}»?`}
          description="Разом із товаром буде видалено журнал операцій і привʼязаний штрихкод. Якщо річ тимчасово скінчилась, достатньо лишити нульову кількість — історія та штрихкод збережуться."
          confirmLabel="Видалити"
          tone="danger"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
