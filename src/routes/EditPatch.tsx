import { useParams } from 'react-router-dom'
import { StampIcon } from '../components/layout/icons'
import PlaceholderPage from '../components/PlaceholderPage'

export default function EditPatch() {
  const { id } = useParams()
  return (
    <PlaceholderPage
      icon={StampIcon}
      title="Edit patch"
      description={`Editing form for patch ${id ?? ''} will appear here.`}
    />
  )
}
