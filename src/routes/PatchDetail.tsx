import { useParams } from 'react-router-dom'
import { StampIcon } from '../components/layout/icons'
import PlaceholderPage from '../components/PlaceholderPage'

export default function PatchDetail() {
  const { id } = useParams()
  return (
    <PlaceholderPage
      icon={StampIcon}
      title="Patch details"
      description={`Full details for patch ${id ?? ''} — dates, location, companions, description, and photos — will appear here.`}
    />
  )
}
