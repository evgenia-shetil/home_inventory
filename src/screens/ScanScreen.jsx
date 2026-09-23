import { useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { findByBarcode, normalizeBarcode, isValidBarcode } from '../domain/barcode.js'
import BarcodeScanner from '../ui/BarcodeScanner.jsx'

export default function ScanScreen() {
  const { items, updateItem } = useInventory()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const attachTo = params.get('attach')
  const [warning, setWarning] = useState(null)

  const handleDetect = useCallback(async raw => {
    const code = normalizeBarcode(raw)

    if (!isValidBarcode(code)) {
      setWarning('Код прочитався неповністю, спробуй ще раз')
      return
    }

    const known = findByBarcode(items, code)

    // Режим прив'язки: пришпилюємо код до конкретного товару.
    if (attachTo) {
      if (known && known.id !== attachTo) {
        setWarning(`Цей штрихкод уже належить товару «${known.name}»`)
        return
      }
      try {
        await updateItem(attachTo, { barcode: code })
        navigate(`/item/${attachTo}`, { replace: true })
      } catch (err) {
        setWarning(err.message)
      }
      return
    }

    // Звичайний режим: свій товар упізнається завжди, незалежно
    // від того, чи є він у зовнішніх каталогах.
    if (known) {
      navigate(`/item/${known.id}`, { replace: true })
      return
    }

    navigate(`/add?barcode=${code}`, { replace: true })
  }, [items, attachTo, updateItem, navigate])

  return (
    <div className="stack">
      <h1>{attachTo ? 'Привʼязати штрихкод' : 'Сканувати'}</h1>
      {warning && <p className="error">{warning}</p>}
      <BarcodeScanner
        onDetect={handleDetect}
        onCancel={() => navigate(attachTo ? `/item/${attachTo}` : '/')}
      />
    </div>
  )
}
