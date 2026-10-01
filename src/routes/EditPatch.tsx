import { useNavigate, useParams } from 'react-router-dom'
import { StampIcon } from '../components/layout/icons'
import PatchForm from '../components/PatchForm'
import PlaceholderPage from '../components/PlaceholderPage'
import { usePatch, useUpdatePatch } from '../hooks/usePatches'
import { useReplacePatchCover, useUploadTripPhoto } from '../hooks/usePatchPhotos'
import { useAddPatchDish } from '../hooks/usePatchDishes'
import { useResolveTripId, useTrip } from '../hooks/useTrips'

export default function EditPatch() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: patch, isLoading } = usePatch(id)
  const { data: currentTrip, isLoading: tripLoading } = useTrip(patch?.trip_id)
  const updatePatch = useUpdatePatch()
  const replaceCover = useReplacePatchCover()
  const uploadTripPhoto = useUploadTripPhoto()
  const addDish = useAddPatchDish()
  const resolveTripId = useResolveTripId()

  if (isLoading || (patch?.trip_id && tripLoading)) {
    return <PlaceholderPage icon={StampIcon} title="Loading…" description="Fetching this patch's details." />
  }

  if (!patch) {
    return <PlaceholderPage icon={StampIcon} title="Patch not found" description="This patch may have been removed." />
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal/10 text-teal">
          <StampIcon className="h-6 w-6" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-teal-dark">Edit patch</h1>
      </div>

      <PatchForm
        initialValues={patch}
        initialTripName={currentTrip?.name}
        submitLabel="Save changes"
        onSubmit={async (values, patchPhoto, tripPhotos, tripName, dishes) => {
          const trip_id = await resolveTripId(tripName)
          await updatePatch.mutateAsync({ id: patch.id, input: { ...values, trip_id } })
          // Supplying a patch photo here replaces the existing one; leaving it
          // empty keeps the current one.
          if (patchPhoto) {
            await replaceCover.mutateAsync({ patchId: patch.id, file: patchPhoto })
          }
          for (const file of tripPhotos) {
            await uploadTripPhoto.mutateAsync({ patchId: patch.id, file })
          }
          for (const dish of dishes) {
            await addDish.mutateAsync({ patchId: patch.id, name: dish.name.trim(), file: dish.file })
          }
          navigate(`/patches/${patch.id}`)
        }}
      />
    </div>
  )
}
