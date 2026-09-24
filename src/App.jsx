import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase.js'
import { InventoryProvider } from './data/InventoryContext.jsx'
import LoginScreen from './screens/LoginScreen.jsx'
import StockScreen from './screens/StockScreen.jsx'
import ShoppingScreen from './screens/ShoppingScreen.jsx'
import ItemScreen from './screens/ItemScreen.jsx'
import CategoryScreen from './screens/CategoryScreen.jsx'
import { Skeleton } from './ui/States.jsx'
import BottomNav from './ui/BottomNav.jsx'
import Toast from './ui/Toast.jsx'
import UpdateWatcher from './ui/UpdateWatcher.jsx'
import NetworkBanner from './ui/NetworkBanner.jsx'
import { lastUserId } from './lib/offlineStore.js'

// Щоденні екрани (запаси, покупки, категорія, картка) — у головному файлі:
// вони потрібні одразу. Решта відкривається зрідка і вантажиться окремими
// шматками, щоб перше відкриття на мобільному інтернеті було швидшим.
// Без мережі вони однаково є: service worker зберігає всі шматки наперед.
const AddItemScreen = lazy(() => import('./screens/AddItemScreen.jsx'))
const SettingsScreen = lazy(() => import('./screens/SettingsScreen.jsx'))
const ScanScreen = lazy(() => import('./screens/ScanScreen.jsx'))
const CategoriesScreen = lazy(() => import('./screens/CategoriesScreen.jsx'))
const SpendingScreen = lazy(() => import('./screens/SpendingScreen.jsx'))
const ExpiryScreen = lazy(() => import('./screens/ExpiryScreen.jsx'))
const UnsortedScreen = lazy(() => import('./screens/UnsortedScreen.jsx'))
const NormsScreen = lazy(() => import('./screens/NormsScreen.jsx'))

// Новий екран відкривається згори. HashRouter цього не робить сам, і
// екран успадковував прокрутку попереднього — «Ще» відкривалось із середини.
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

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
      <ScrollToTop />
      <main className="screen">
        <Suspense fallback={<Skeleton count={3} />}>
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
          <Route path="/norms" element={<NormsScreen />} />
          <Route path="/item/:id" element={<ItemScreen />} />
          <Route path="/settings" element={<SettingsScreen email={session?.user.email ?? null} />} />
        </Routes>
        </Suspense>
      </main>
      <NetworkBanner />
      <Toast />
      <UpdateWatcher />
      <BottomNav />
    </InventoryProvider>
  )
}
