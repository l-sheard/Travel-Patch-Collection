import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Patch, PatchPhoto } from '../types/patch'
import { usePhotoUrl } from '../hooks/usePhotoUrl'

type MappablePatch = Pick<Patch, 'id' | 'location_name' | 'country' | 'lat' | 'lng'> & {
  patch_photos?: PatchPhoto[]
}

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

function PatchPopupContent({ patch }: { patch: MappablePatch }) {
  const cover = patch.patch_photos?.find((p) => p.is_cover) ?? patch.patch_photos?.[0]
  const bucket = cover?.storage_path_gallery ? 'patch-gallery' : 'patch-originals'
  const path = cover?.storage_path_gallery ?? cover?.storage_path_original
  const { data: url } = usePhotoUrl(bucket, path)

  return (
    <Link to={`/patches/${patch.id}`} className="block w-32">
      <div className="mb-1.5 flex aspect-square items-center justify-center rounded-lg bg-cream-dark/60 p-0.5">
        {url ? (
          <img src={url} alt="" className="h-full w-full object-contain" />
        ) : (
          <div className="h-full w-full animate-pulse rounded bg-ink/5" />
        )}
      </div>
      <p className="font-display text-sm font-semibold text-teal-dark">{patch.location_name}</p>
      {patch.country && <p className="text-xs text-ink/50">{patch.country}</p>}
      <span className="mt-1 inline-block text-xs font-medium text-teal hover:underline">View details</span>
    </Link>
  )
}

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
              <PatchPopupContent patch={patch} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
