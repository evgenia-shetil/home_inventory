export default function CategoryStrip({
  categories, selected, onSelect, allLabel = 'усі', extra = null,
}) {
  return (
    <nav className="strip" aria-label="Категорії">
      <button
        className={`chip${selected === null ? ' chip--on' : ''}`}
        onClick={() => onSelect(null)}
      >
        {allLabel}
      </button>

      {/* Окрема вкладка для нерозкладеного: без неї такі товари губляться
          серед решти, і знайти їх можна лише перебором категорій. */}
      {extra && (
        <button
          className={`chip chip--extra${selected === extra.id ? ' chip--on' : ''}`}
          onClick={() => onSelect(extra.id)}
        >
          {extra.name}
        </button>
      )}

      {categories.map(c => (
        <button
          key={c.id}
          className={`chip${selected === c.id ? ' chip--on' : ''}`}
          onClick={() => onSelect(c.id)}
        >
          {c.name}
        </button>
      ))}
    </nav>
  )
}
