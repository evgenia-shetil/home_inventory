export default function CategoryStrip({ categories, selected, onSelect, allLabel = 'усі' }) {
  return (
    <nav className="strip" aria-label="Категорії">
      <button
        className={`chip${selected === null ? ' chip--on' : ''}`}
        onClick={() => onSelect(null)}
      >
        {allLabel}
      </button>
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
