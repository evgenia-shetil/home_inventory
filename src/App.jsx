import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { supabase } from './lib/supabase.js'
import { InventoryProvider } from './data/InventoryContext.jsx'
import LoginScreen from './screens/LoginScreen.jsx'
import StockScreen from './screens/StockScreen.jsx'
import ShoppingScreen from './screens/ShoppingScreen.jsx'
import AddItemScreen from './screens/AddItemScreen.jsx'
import ItemScreen from './screens/ItemScreen.jsx'
import BottomNav from './ui/BottomNav.jsx'
import UndoToast from './ui/UndoToast.jsx'
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
          <Route path="/item/:id" element={<ItemScreen />} />
        </Routes>
      </main>
      <NetworkBanner />
      <UndoToast />
      <BottomNav />
    </InventoryProvider>
  )
}
