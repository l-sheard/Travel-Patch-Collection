import { Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import Dashboard from './routes/Dashboard'
import Scan from './routes/Scan'
import AddPatch from './routes/AddPatch'
import PatchDetail from './routes/PatchDetail'
import EditPatch from './routes/EditPatch'
import Gallery from './routes/Gallery'
import MapView from './routes/MapView'
import Settings from './routes/Settings'

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="scan" element={<Scan />} />
        <Route path="patches/new" element={<AddPatch />} />
        <Route path="patches/:id" element={<PatchDetail />} />
        <Route path="patches/:id/edit" element={<EditPatch />} />
        <Route path="gallery" element={<Gallery />} />
        <Route path="map" element={<MapView />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

export default App
