// Мінімальний набір іконок одного накреслення. Іконка ставиться лише там,
// де вона економить читання: у навігації та біля дій, що повторюються.
const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true }
const stroke = { stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

export const IconStock = () => (
  <svg {...base}><path {...stroke} d="M4 7h16M4 12h16M4 17h16" /></svg>
)

export const IconCart = () => (
  <svg {...base}>
    <path {...stroke} d="M3 4h2l2.4 10.4a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L20 8H6" />
    <circle {...stroke} cx="10" cy="20" r="1" />
    <circle {...stroke} cx="17" cy="20" r="1" />
  </svg>
)

export const IconMore = () => (
  <svg {...base}>
    <circle {...stroke} cx="5" cy="12" r="1" />
    <circle {...stroke} cx="12" cy="12" r="1" />
    <circle {...stroke} cx="19" cy="12" r="1" />
  </svg>
)

export const IconTrash = () => (
  <svg {...base} width="18" height="18">
    <path {...stroke} d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </svg>
)

export const IconEdit = () => (
  <svg {...base} width="18" height="18">
    <path {...stroke} d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
  </svg>
)

export const IconPlus = () => (
  <svg {...base} width="24" height="24"><path {...stroke} d="M12 5v14M5 12h14" /></svg>
)
