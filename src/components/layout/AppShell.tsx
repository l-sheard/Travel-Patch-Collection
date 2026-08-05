import { NavLink, Outlet } from 'react-router-dom'
import type { ReactNode } from 'react'
import {
  GalleryIcon,
  HomeIcon,
  MapIcon,
  PlusIcon,
  ScanIcon,
  SettingsIcon,
  StampIcon,
} from './icons'

type NavItem = {
  to: string
  label: string
  icon: (props: { className?: string }) => ReactNode
  end?: boolean
}

const navItems: NavItem[] = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/scan', label: 'Scan', icon: ScanIcon },
  { to: '/gallery', label: 'Gallery', icon: GalleryIcon },
  { to: '/map', label: 'Map', icon: MapIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

function navLinkClasses(isActive: boolean) {
  return [
    'flex flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors',
    'md:flex-row md:gap-2 md:px-3.5 md:py-2 md:text-sm',
    isActive
      ? 'text-teal md:bg-teal/10 md:text-teal-dark'
      : 'text-ink/50 hover:text-teal md:text-ink/70',
  ].join(' ')
}

export default function AppShell() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:px-6">
          <NavLink to="/" className="flex items-center gap-2 font-display text-xl font-semibold text-teal-dark">
            <StampIcon className="h-7 w-7 text-terracotta" />
            My Travel Patches
          </NavLink>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => navLinkClasses(isActive)}>
                <Icon className="h-4.5 w-4.5" />
                {label}
              </NavLink>
            ))}
          </nav>

          <NavLink
            to="/patches/new"
            className="hidden items-center gap-1.5 rounded-full bg-terracotta px-4 py-2 text-sm font-semibold text-cream shadow-sm transition-transform active:scale-95 hover:bg-terracotta-dark md:flex"
          >
            <PlusIcon className="h-4 w-4" />
            Add Patch
          </NavLink>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 md:px-6 md:pb-10">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t border-ink/10 bg-cream/95 py-2 backdrop-blur md:hidden">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => navLinkClasses(isActive)}>
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
        <NavLink to="/patches/new" className={({ isActive }) => navLinkClasses(isActive)}>
          <PlusIcon className="h-5 w-5" />
          Add
        </NavLink>
      </nav>
    </div>
  )
}
