import { useNavigate } from 'react-router-dom'
import { PlusIcon } from '../components/layout/icons'
import PatchForm from '../components/PatchForm'
import { useCreatePatch } from '../hooks/usePatches'
import { useUploadPatchPhoto } from '../hooks/usePatchPhotos'
import { useAddPatchDish } from '../hooks/usePatchDishes'
import { useResolveTripId } from '../hooks/useTrips'

export default function AddPatch() {
  const navigate = useNavigate()
  const createPatch = useCreatePatch()
  const uploadPhoto = useUploadPatchPhoto()
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
          const trip_id = await resolveTripId(tripName)
          const patch = await createPatch.mutateAsync({ ...values, trip_id })
          if (patchPhoto) {
            await uploadPhoto.mutateAsync({ patchId: patch.id, file: patchPhoto, isCover: true })
          }
          for (const file of tripPhotos) {
            await uploadPhoto.mutateAsync({ patchId: patch.id, file, isCover: false })
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
