import { useInventory } from '../data/InventoryContext.jsx'

export default function NetworkBanner() {
  const { online } = useInventory()
  if (online) return null
  return <div className="banner" role="alert">Немає звʼязку. Підключення відновиться автоматично.</div>
}
