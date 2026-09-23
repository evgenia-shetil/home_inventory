export function Skeleton({ count = 4 }) {
  return (
    <div className="grid">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card skeleton" aria-hidden="true" />
      ))}
    </div>
  )
}

export function Empty({ title, action }) {
  return (
    <div className="empty">
      <p>{title}</p>
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="empty">
      <p className="error">{message}</p>
      <button onClick={onRetry}>Спробувати ще</button>
    </div>
  )
}
