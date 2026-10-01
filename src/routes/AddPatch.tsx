import { useNavigate } from 'react-router-dom'
import { PlusIcon } from '../components/layout/icons'
import PatchForm from '../components/PatchForm'
import { useCreatePatchWithCover } from '../hooks/usePatches'
import { useUploadTripPhoto } from '../hooks/usePatchPhotos'
import { useAddPatchDish } from '../hooks/usePatchDishes'
import { useResolveTripId } from '../hooks/useTrips'

export default function AddPatch() {
  const navigate = useNavigate()
  const createPatch = useCreatePatchWithCover()
  const uploadTripPhoto = useUploadTripPhoto()
  const addDish = useAddPatchDish()
  const resolveTripId = useResolveTripId()

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal/10 text-teal">
          <PlusIcon className="h-6 w-6" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-teal-dark">Add a patch</h1>
      </div>

      <PatchForm
        submitLabel="Save patch"
        requirePatchPhoto
        onSubmit={async (values, patchPhoto, tripPhotos, tripName, dishes) => {
          if (!patchPhoto) throw new Error('Add a photo of the patch.')

          const trip_id = await resolveTripId(tripName)

          // The patch and its photo of the patch are created together, so
          // there's no point at which a patch exists without one.
          const { patch } = await createPatch.mutateAsync({
            input: { ...values, trip_id },
            coverFile: patchPhoto,
          })

          // Everything below is optional. Failing here leaves a patch that is
          // still valid, just missing some of its extras.
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
