// Скелетон повторює форму екрана, який вантажиться: сітка високих
// карток на місці плиток і рядків читалась як інший екран.
export function Skeleton({ count = 4, variant = 'grid' }) {
  if (variant === 'home') {
    return (
      <div className="stack" aria-hidden="true">
        <div className="skeleton skeleton--bar" />
        <div className="skeleton skeleton--buy" />
        <div className="tiles">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton skeleton--tile" />)}
        </div>
      </div>
    )
  }
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
      <button onClick={onRetry}>Повторити</button>
    </div>
  )
}
