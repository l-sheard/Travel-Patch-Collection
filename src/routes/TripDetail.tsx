import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { StampIcon } from '../components/layout/icons'
import PatchCard from '../components/PatchCard'
import PlaceholderPage from '../components/PlaceholderPage'
import StarRating from '../components/StarRating'
import { useTrip, useTripSiblingPatches, useUpdateTrip } from '../hooks/useTrips'

function TripTextSection({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink/40">{label}</p>
      <p className="whitespace-pre-wrap rounded-xl border border-dashed border-ink/15 p-3 text-sm text-ink/80">
        {value}
      </p>
    </div>
  )
}

function EditField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
      {label}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
      />
    </label>
  )
}

export default function TripDetail() {
  const { id } = useParams()
  const { data: trip, isLoading, isError } = useTrip(id)
  const { data: patches } = useTripSiblingPatches(id, undefined)
  const updateTrip = useUpdateTrip()

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [itinerary, setItinerary] = useState('')
  const [highlights, setHighlights] = useState('')
  const [tripReview, setTripReview] = useState('')

  if (isLoading) {
    return <PlaceholderPage icon={StampIcon} title="Loading…" description="Fetching this trip's details." />
  }

  if (isError || !trip) {
    return <PlaceholderPage icon={StampIcon} title="Trip not found" description="This trip may have been removed." />
  }

  function startEditing() {
    setName(trip!.name)
    setRating(trip!.rating)
    setItinerary(trip!.itinerary ?? '')
    setHighlights(trip!.highlights ?? '')
    setTripReview(trip!.trip_review ?? '')
    setEditing(true)
  }

  async function handleSave() {
    await updateTrip.mutateAsync({
      id: trip!.id,
      input: {
        name: name.trim() || trip!.name,
        rating,
        itinerary: itinerary.trim() || null,
        highlights: highlights.trim() || null,
        trip_review: tripReview.trim() || null,
      },
    })
    setEditing(false)
  }

  const hasAnyDetails = trip.rating != null || trip.itinerary || trip.highlights || trip.trip_review

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-3xl border border-ink/10 bg-white/60 p-6 shadow-sm">
        <div className="mb-5 flex items-start justify-between gap-4">
          {editing ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-ink/15 bg-white px-3 py-2 font-display text-xl font-semibold text-teal-dark outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
            />
          ) : (
            <div>
              <h1 className="font-display text-3xl font-semibold text-teal-dark">{trip.name}</h1>
              {trip.rating != null && (
                <div className="mt-1">
                  <StarRating value={trip.rating} readOnly size="text-base" />
                </div>
              )}
            </div>
          )}
          {!editing && (
            <button
              type="button"
              onClick={startEditing}
              className="shrink-0 rounded-full border border-teal px-3 py-1.5 text-xs font-semibold text-teal-dark hover:bg-teal/10"
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-ink/80">
              Overall rating
              <StarRating value={rating} onChange={setRating} />
            </label>
            <EditField label="Itinerary" value={itinerary} onChange={setItinerary} />
            <EditField label="Highlights" value={highlights} onChange={setHighlights} />
            <EditField label="Trip review" value={tripReview} onChange={setTripReview} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={updateTrip.isPending}
                className="rounded-full bg-terracotta px-5 py-2 text-sm font-semibold text-cream shadow-sm hover:bg-terracotta-dark disabled:opacity-60"
              >
                {updateTrip.isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-full border border-ink/15 px-5 py-2 text-sm font-medium text-ink/60 hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <TripTextSection label="Itinerary" value={trip.itinerary} />
            <TripTextSection label="Highlights" value={trip.highlights} />
            <TripTextSection label="Trip review" value={trip.trip_review} />
            {!hasAnyDetails && (
              <p className="text-sm text-ink/50">
                No rating, itinerary, highlights, or review yet — click Edit to add some.
              </p>
            )}
          </div>
        )}

        {patches && patches.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/40">Stops on this trip</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {patches.map((patch) => (
                <PatchCard key={patch.id} patch={patch} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
