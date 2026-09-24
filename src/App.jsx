import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { supabase } from './lib/supabase.js'
import { InventoryProvider } from './data/InventoryContext.jsx'
import LoginScreen from './screens/LoginScreen.jsx'
import StockScreen from './screens/StockScreen.jsx'
import ShoppingScreen from './screens/ShoppingScreen.jsx'
import AddItemScreen from './screens/AddItemScreen.jsx'
import ItemScreen from './screens/ItemScreen.jsx'
import SettingsScreen from './screens/SettingsScreen.jsx'
import ScanScreen from './screens/ScanScreen.jsx'
import CategoriesScreen from './screens/CategoriesScreen.jsx'
import CategoryScreen from './screens/CategoryScreen.jsx'
import SpendingScreen from './screens/SpendingScreen.jsx'
import ExpiryScreen from './screens/ExpiryScreen.jsx'
import UnsortedScreen from './screens/UnsortedScreen.jsx'
import BottomNav from './ui/BottomNav.jsx'
import Toast from './ui/Toast.jsx'
import UpdateWatcher from './ui/UpdateWatcher.jsx'
import NetworkBanner from './ui/NetworkBanner.jsx'
import { lastUserId } from './lib/offlineStore.js'

export default function App() {
  const [session, setSession] = useState(undefined)
  // Без мережі сесія не оновлюється: після години простою getSession()
  // віддає null, а сама спроба оновлення триває до пів хвилини. Екран
  // входу без мережі марний, тож одразу відкриваємо знімок з пристрою.
  const [offlineUser, setOfflineUser] = useState(() => (navigator.onLine ? null : lastUserId()))

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'SIGNED_OUT') setOfflineUser(null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const down = () => { if (!session) setOfflineUser(lastUserId()) }
    window.addEventListener('offline', down)
    return () => window.removeEventListener('offline', down)
  }, [session])

  const userId = session?.user.id ?? offlineUser
  if (!userId && session === undefined) return <main className="screen center">Завантаження…</main>
  if (!userId) return <LoginScreen />

  return (
    <InventoryProvider userId={userId}>
      <main className="screen">
        <Routes>
          <Route path="/" element={<StockScreen />} />
          <Route path="/shopping" element={<ShoppingScreen />} />
          <Route path="/add" element={<AddItemScreen />} />
          <Route path="/scan" element={<ScanScreen />} />
          <Route path="/categories" element={<CategoriesScreen />} />
          <Route path="/category/:id" element={<CategoryScreen />} />
          <Route path="/spending" element={<SpendingScreen />} />
          <Route path="/expiring" element={<ExpiryScreen />} />
          <Route path="/unsorted" element={<UnsortedScreen />} />
          <Route path="/item/:id" element={<ItemScreen />} />
          <Route path="/settings" element={<SettingsScreen email={session?.user.email ?? null} />} />
        </Routes>
      </main>
      <NetworkBanner />
      <Toast />
      <UpdateWatcher />
      <BottomNav />
    </InventoryProvider>
  )
}
