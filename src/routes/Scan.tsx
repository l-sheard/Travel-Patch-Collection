import { ScanIcon } from '../components/layout/icons'
import PlaceholderPage from '../components/PlaceholderPage'

export default function Scan() {
  return (
    <PlaceholderPage
      icon={ScanIcon}
      title="Scan a patch"
      description="Point your camera at a patch and we'll try to match it against your collection. Coming once camera capture and matching are wired up."
    />
  )
}
