import { useState, type FormEvent, type ReactNode } from 'react'
import PhotoCapture from './PhotoCapture'
import CompanionsInput from './CompanionsInput'
import AccommodationsInput from './AccommodationsInput'
import RestaurantsInput from './RestaurantsInput'
import DishesInput, { type PendingDish } from './DishesInput'
import HolidayTypeInput from './HolidayTypeInput'
import LocationPicker from './LocationPicker'
import CountryInput from './CountryInput'
import StarRating from './StarRating'
import { useTrips } from '../hooks/useTrips'
import type { Accommodation, NewPatchInput, Restaurant } from '../types/patch'
import type { GeocodeResult } from '../lib/geocode'

export type PatchFormValues = Omit<NewPatchInput, 'trip_id'>

type Props = {
  initialValues?: Partial<PatchFormValues>
  initialTripName?: string
  submitLabel: string
  requirePatchPhoto?: boolean
  onSubmit: (
    values: PatchFormValues,
    patchPhoto: File | null,
    tripPhotos: File[],
    tripName: string,
    dishes: PendingDish[],
  ) => Promise<void>
}

export default function PatchForm({
  initialValues,
  initialTripName,
  submitLabel,
  requirePatchPhoto,
  onSubmit,
}: Props) {
  const { data: trips } = useTrips()
  const [locationName, setLocationName] = useState(initialValues?.location_name ?? '')
  const [country, setCountry] = useState(initialValues?.country ?? '')
  const [lat, setLat] = useState<number | null>(initialValues?.lat ?? null)
  const [lng, setLng] = useState<number | null>(initialValues?.lng ?? null)
  const [geocodeRaw, setGeocodeRaw] = useState<unknown>(initialValues?.geocode_raw ?? null)
  const [tripStart, setTripStart] = useState(initialValues?.trip_start_date ?? '')
  const [tripEnd, setTripEnd] = useState(initialValues?.trip_end_date ?? '')
  const [purchasedDate, setPurchasedDate] = useState(initialValues?.purchased_date ?? '')
  const [companions, setCompanions] = useState<string[]>(initialValues?.companions ?? [])
  const [description, setDescription] = useState(initialValues?.description ?? '')
  const [accommodations, setAccommodations] = useState<Accommodation[]>(initialValues?.accommodations ?? [])
  const [restaurants, setRestaurants] = useState<Restaurant[]>(initialValues?.restaurants ?? [])
  const [dishes, setDishes] = useState<PendingDish[]>([])
  const [rating, setRating] = useState<number | null>(initialValues?.rating ?? null)
  const [review, setReview] = useState(initialValues?.review ?? '')
  const [itinerary, setItinerary] = useState(initialValues?.itinerary ?? '')
  const [highlights, setHighlights] = useState(initialValues?.highlights ?? '')
  const [holidayTypes, setHolidayTypes] = useState<string[]>(initialValues?.holiday_types ?? [])
  const [price, setPrice] = useState<string>(initialValues?.price != null ? String(initialValues.price) : '')
  const [tripName, setTripName] = useState(initialTripName ?? '')
  const [patchPhotoFiles, setPatchPhotoFiles] = useState<File[]>([])
  const [tripPhotos, setTripPhotos] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function handleLocationSelect(result: GeocodeResult) {
    setLocationName(result.name)
    if (result.country) setCountry(result.country)
    setLat(result.lat)
    setLng(result.lng)
    setGeocodeRaw(result.raw)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!locationName.trim()) {
      setError('Location is required.')
      return
    }

    if (requirePatchPhoto && patchPhotoFiles.length === 0) {
      setError('Add a photo of the patch.')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit(
        {
          location_name: locationName.trim(),
          country: country?.trim() || null,
          lat,
          lng,
          geocode_raw: geocodeRaw,
          trip_start_date: tripStart || null,
          trip_end_date: tripEnd || null,
          purchased_date: purchasedDate || null,
          companions,
          description: description?.trim() || null,
          accommodations: accommodations
            .filter((a) => a.name.trim())
            .map((a) => ({
              name: a.name.trim(),
              url: a.url?.trim() || null,
              rating: a.rating,
              notes: a.notes?.trim() || null,
              nights: a.nights,
              people: a.people,
            })),
          restaurants: restaurants
            .filter((r) => r.name.trim())
            .map((r) => ({ name: r.name.trim(), url: r.url?.trim() || null })),
          rating,
          review: review?.trim() || null,
          itinerary: itinerary?.trim() || null,
          highlights: highlights?.trim() || null,
          holiday_types: holidayTypes,
          price: price.trim() ? Number(price) : null,
        },
        patchPhotoFiles[0] ?? null,
        tripPhotos,
        tripName.trim(),
        dishes.filter((d) => d.name.trim() || d.file),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Photo of the patch" required={requirePatchPhoto}>
        <p className="mb-1.5 -mt-0.5 text-xs font-normal text-ink/50">
          This becomes your gallery sticker and lets you scan this patch later to find it again.
        </p>
        <PhotoCapture files={patchPhotoFiles} onChange={setPatchPhotoFiles} max={1} addLabel="Add photo" />
      </Field>

      <Field label="Location" required>
        <LocationPicker value={locationName} onChange={setLocationName} onSelect={handleLocationSelect} />
      </Field>

      <Field label="Country">
        <CountryInput value={country ?? ''} onChange={setCountry} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Trip start">
          <input
            type="date"
            value={tripStart ?? ''}
            onChange={(e) => setTripStart(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Trip end">
          <input
            type="date"
            value={tripEnd ?? ''}
            onChange={(e) => setTripEnd(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Purchased on">
        <input
          type="date"
          value={purchasedDate ?? ''}
          onChange={(e) => setPurchasedDate(e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field label="Price (optional)">
        <input
          type="number"
          min={0}
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="e.g. 450"
          className={inputClass}
        />
      </Field>

      <Field label="Part of a trip?">
        <p className="mb-1.5 -mt-0.5 text-xs font-normal text-ink/50">
          Give it a name to link it with other patches from the same trip — e.g. "Balkans Summer 2024". Leave blank
          for a standalone patch.
        </p>
        <input
          type="text"
          list="trip-options"
          value={tripName}
          onChange={(e) => setTripName(e.target.value)}
          placeholder="e.g. Balkans Summer 2024"
          className={inputClass}
        />
        <datalist id="trip-options">
          {(trips ?? []).map((trip) => (
            <option key={trip.id} value={trip.name} />
          ))}
        </datalist>
      </Field>

      <Field label="Type of holiday">
        <HolidayTypeInput value={holidayTypes} onChange={setHolidayTypes} />
      </Field>

      <Field label="Travelled with">
        <CompanionsInput value={companions} onChange={setCompanions} />
      </Field>

      <Field label="Where we stayed (optional)">
        <AccommodationsInput value={accommodations} onChange={setAccommodations} />
      </Field>

      <Field label="Good restaurants (optional)">
        <RestaurantsInput value={restaurants} onChange={setRestaurants} />
      </Field>

      <Field label="Favorite dishes (optional)">
        <p className="mb-1.5 -mt-0.5 text-xs font-normal text-ink/50">
          Just a name is fine — a photo is optional.
        </p>
        <DishesInput value={dishes} onChange={setDishes} />
      </Field>

      <Field label="Your rating">
        <StarRating value={rating} onChange={setRating} />
      </Field>

      <Field label="Review">
        <textarea
          value={review ?? ''}
          onChange={(e) => setReview(e.target.value)}
          rows={3}
          placeholder="What did you think of this place?"
          className={inputClass}
        />
      </Field>

      <Field label="Itinerary">
        <textarea
          value={itinerary ?? ''}
          onChange={(e) => setItinerary(e.target.value)}
          rows={3}
          placeholder="What you did here..."
          className={inputClass}
        />
      </Field>

      <Field label="Highlights">
        <textarea
          value={highlights ?? ''}
          onChange={(e) => setHighlights(e.target.value)}
          rows={3}
          placeholder="Favorite moments from this stop..."
          className={inputClass}
        />
      </Field>

      <Field label="Notes">
        <textarea
          value={description ?? ''}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Notes about the trip, the patch, anything worth remembering..."
          className={inputClass}
        />
      </Field>

      <Field label="Other trip photos (optional)">
        <PhotoCapture files={tripPhotos} onChange={setTripPhotos} addLabel="Add photo" />
      </Field>

      {error && <p className="text-sm text-terracotta-dark">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="mt-2 self-start rounded-full bg-terracotta px-6 py-2.5 text-sm font-semibold text-cream shadow-sm transition-transform active:scale-95 hover:bg-terracotta-dark disabled:opacity-60"
      >
        {submitting ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}

const inputClass =
  'rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20'

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
      <span>
        {label}
        {required && <span className="text-terracotta"> *</span>}
      </span>
      {children}
    </label>
  )
}
