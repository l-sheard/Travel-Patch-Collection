import { useNavigate, useParams } from 'react-router-dom'
import { StampIcon } from '../components/layout/icons'
import PatchForm from '../components/PatchForm'
import PlaceholderPage from '../components/PlaceholderPage'
import { usePatch, useUpdatePatch } from '../hooks/usePatches'
import { useUploadPatchPhoto } from '../hooks/usePatchPhotos'
import { useResolveTripId, useTrip } from '../hooks/useTrips'

export default function EditPatch() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: patch, isLoading } = usePatch(id)
  const { data: currentTrip, isLoading: tripLoading } = useTrip(patch?.trip_id)
  const updatePatch = useUpdatePatch()
  const uploadPhoto = useUploadPatchPhoto()
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
        onSubmit={async (values, patchPhoto, tripPhotos, tripName) => {
          const trip_id = await resolveTripId(tripName)
          await updatePatch.mutateAsync({ id: patch.id, input: { ...values, trip_id } })
          if (patchPhoto) {
            await uploadPhoto.mutateAsync({ patchId: patch.id, file: patchPhoto, isCover: true })
          }
          for (const file of tripPhotos) {
            await uploadPhoto.mutateAsync({ patchId: patch.id, file, isCover: false })
          }
          navigate(`/patches/${patch.id}`)
        }}
      />
    </div>
  )
}
