import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Patch } from '../types/patch'

type MappablePatch = Pick<Patch, 'id' | 'location_name' | 'country' | 'lat' | 'lng'>

const patchIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      width: 30px; height: 30px; border-radius: 9999px;
      background: #1F6F78; border: 2.5px solid #FBF6EC;
      box-shadow: 0 2px 6px rgba(43,36,32,0.35);
      display: flex; align-items: center; justify-content: center;
    ">
      <div style="width: 10px; height: 10px; border-radius: 9999px; background: #E4772E;"></div>
    </div>
  `,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -15],
})

type Props = {
  patches: MappablePatch[]
  className?: string
}

export default function PatchMap({ patches, className = 'h-[70vh]' }: Props) {
  const pinned = useMemo(() => patches.filter((p) => p.lat != null && p.lng != null), [patches])

  const center: [number, number] = useMemo(() => {
    if (pinned.length === 0) return [20, 0]
    const avgLat = pinned.reduce((sum, p) => sum + (p.lat as number), 0) / pinned.length
    const avgLng = pinned.reduce((sum, p) => sum + (p.lng as number), 0) / pinned.length
    return [avgLat, avgLng]
  }, [pinned])

  const zoom = pinned.length === 0 ? 2 : pinned.length === 1 ? 9 : 3

  return (
    <div className={`${className} overflow-hidden rounded-3xl border border-ink/10 shadow-sm`}>
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pinned.map((patch) => (
          <Marker key={patch.id} position={[patch.lat as number, patch.lng as number]} icon={patchIcon}>
            <Popup>
              <div className="min-w-36">
                <p className="font-display text-sm font-semibold text-teal-dark">{patch.location_name}</p>
                {patch.country && <p className="text-xs text-ink/50">{patch.country}</p>}
                <Link to={`/patches/${patch.id}`} className="mt-1 inline-block text-xs font-medium text-teal hover:underline">
                  View details
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
