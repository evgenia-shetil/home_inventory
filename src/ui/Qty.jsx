import { formatNumber } from '../lib/format.js'

export default function Qty({ value, unit, className = '' }) {
  return (
    <span className={`qty ${className}`.trim()}>
      <b className="qty__num num">{formatNumber(value)}</b>
      {unit && <span className="qty__unit">{unit}</span>}
    </span>
  )
}
