import { Link } from 'react-router'
import { ChevronRight, LogOut, UserRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { accessLabel, visibleMenus } from '../../lib/permissions'
import { PageHeader } from '../../components/ui/misc'

// Daftar semua menu untuk HP (yang tidak muat di navigasi bawah)
export default function Lainnya() {
  const { profile, signOut } = useAuth()
  const menus = visibleMenus(profile.role).filter((m) => m.key !== 'beranda')

  return (
    <div>
      <PageHeader title="Semua menu" />
      <ul className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        {menus.map((m) => {
          const Icon = m.icon
          const akses = accessLabel(profile, m.key)
          return (
            <li key={m.key} className="border-b border-line last:border-0">
              <Link to={m.path} className="flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-soft/60">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-soft text-primary">
                  <Icon aria-hidden="true" className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg leading-snug font-extrabold">{m.label}</span>
                  {akses && <span className="block text-base text-muted">{akses.text}</span>}
                </span>
                <ChevronRight aria-hidden="true" className="size-6 text-muted" />
              </Link>
            </li>
          )
        })}
      </ul>

      <ul className="mt-5 overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <li className="border-b border-line">
          <Link to="/profil" className="flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-soft/60">
            <span className="grid size-11 place-items-center rounded-2xl bg-soft text-primary">
              <UserRound aria-hidden="true" className="size-6" />
            </span>
            <span className="flex-1 text-lg font-extrabold">Profil saya</span>
            <ChevronRight aria-hidden="true" className="size-6 text-muted" />
          </Link>
        </li>
        <li>
          <button
            type="button"
            onClick={signOut}
            className="flex min-h-16 w-full items-center gap-4 px-4 py-3 text-left hover:bg-soft/60"
          >
            <span className="grid size-11 place-items-center rounded-2xl bg-danger-soft text-danger">
              <LogOut aria-hidden="true" className="size-6" />
            </span>
            <span className="flex-1 text-lg font-extrabold text-danger">Keluar</span>
          </button>
        </li>
      </ul>
    </div>
  )
}
