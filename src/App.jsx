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
import BottomNav from './ui/BottomNav.jsx'
import Toast from './ui/Toast.jsx'
import NetworkBanner from './ui/NetworkBanner.jsx'

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <main className="screen center">Завантаження…</main>
  if (!session) return <LoginScreen />

  return (
    <InventoryProvider userId={session.user.id}>
      <main className="screen">
        <Routes>
          <Route path="/" element={<StockScreen />} />
          <Route path="/shopping" element={<ShoppingScreen />} />
          <Route path="/add" element={<AddItemScreen />} />
          <Route path="/scan" element={<ScanScreen />} />
          <Route path="/categories" element={<CategoriesScreen />} />
          <Route path="/category/:id" element={<CategoryScreen />} />
          <Route path="/item/:id" element={<ItemScreen />} />
          <Route path="/settings" element={<SettingsScreen email={session.user.email} />} />
        </Routes>
      </main>
      <NetworkBanner />
      <Toast />
      <BottomNav />
    </InventoryProvider>
  )
}
