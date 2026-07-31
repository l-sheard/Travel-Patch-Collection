import { HomeIcon } from '../components/layout/icons'
import PlaceholderPage from '../components/PlaceholderPage'

export default function Dashboard() {
  return (
    <PlaceholderPage
      icon={HomeIcon}
      title="Your collection"
      description="Once you're signed in, this page will show your patch count, countries visited, and your most recent finds."
    />
  )
}
