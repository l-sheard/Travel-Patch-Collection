export type GeocodeResult = {
  displayName: string
  name: string
  country: string | null
  lat: number
  lng: number
  raw: unknown
}

type NominatimAddress = {
  city?: string
  town?: string
  village?: string
  county?: string
  state?: string
  country?: string
}

type NominatimResult = {
  display_name: string
  lat: string
  lon: string
  address?: NominatimAddress
}

export async function searchLocations(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 3) return []

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', trimmed)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', '6')

  const res = await fetch(url.toString(), { signal })
  if (!res.ok) throw new Error('Location lookup failed')
  const data = (await res.json()) as NominatimResult[]

  return data.map((item) => ({
    displayName: item.display_name,
    name:
      item.address?.city ||
      item.address?.town ||
      item.address?.village ||
      item.address?.county ||
      item.address?.state ||
      item.display_name.split(',')[0],
    country: item.address?.country ?? null,
    lat: Number(item.lat),
    lng: Number(item.lon),
    raw: item,
  }))
}
