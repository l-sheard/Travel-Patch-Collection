import { Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import Dashboard from './routes/Dashboard'
import Scan from './routes/Scan'
import AddPatch from './routes/AddPatch'
import PatchDetail from './routes/PatchDetail'
import EditPatch from './routes/EditPatch'
import TripDetail from './routes/TripDetail'
import Gallery from './routes/Gallery'
import MapView from './routes/MapView'
import Settings from './routes/Settings'
import SignIn from './routes/SignIn'
import ResetPassword from './routes/ResetPassword'
import PlaceholderPage from './components/PlaceholderPage'
import { StampIcon } from './components/layout/icons'
import { useAuth } from './context/AuthProvider'

function NotFound() {
  return (
    <PlaceholderPage
      icon={StampIcon}
      title="Page not found"
      description="That page doesn't exist — use the nav above to find your way back."
    />
  )
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream">
      <StampIcon className="h-10 w-10 animate-pulse text-teal/50" />
    </div>
  )
}

function App() {
  const { session, loading, isPasswordRecovery } = useAuth()

  if (loading) return <LoadingScreen />
  if (isPasswordRecovery) return <ResetPassword />
  if (!session) return <SignIn />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="scan" element={<Scan />} />
        <Route path="patches/new" element={<AddPatch />} />
        <Route path="patches/:id" element={<PatchDetail />} />
        <Route path="patches/:id/edit" element={<EditPatch />} />
        <Route path="trips/:id" element={<TripDetail />} />
        <Route path="gallery" element={<Gallery />} />
        <Route path="map" element={<MapView />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App
