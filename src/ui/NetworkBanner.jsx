import { useInventory } from '../data/InventoryContext.jsx'

export default function NetworkBanner() {
  const { online } = useInventory()
  if (online) return null
  return <div className="banner" role="alert">Немає зв'язку. Спробую ще, коли з'явиться.</div>
}
