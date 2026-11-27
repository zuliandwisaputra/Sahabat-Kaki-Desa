import { Suspense, useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useLocation, useMatches } from 'react-router'
import { LogOut, Menu } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { bottomNavMenus, ROLE_LABELS, visibleMenus } from '../../lib/permissions'
import { Avatar } from '../ui/Avatar'
import { Banner, Spinner } from '../ui/misc'
import { Brand } from './Brand'
import { NotificationBell } from './NotificationBell'

function usePageTitle() {
  const matches = useMatches()
  const title = [...matches].reverse().find((m) => m.handle?.title)?.handle.title
  useEffect(() => {
    document.title = title ? `${title} · Sahabat Kaki Desa` : 'Sahabat Kaki Desa'
  }, [title])
  return title ?? 'Sahabat Kaki Desa'
}

/**
 * Animasi muncul saat di-scroll: kartu di dalam halaman memudar & naik sedikit
 * ketika masuk layar. Tidak berjalan jika pengguna memilih "kurangi animasi".
 */
function useMunculSaatScroll(ref) {
  useEffect(() => {
    const akar = ref.current
    if (!akar || !('IntersectionObserver' in window)) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const io = new IntersectionObserver(
      (entri) => {
        for (const e of entri) {
          if (e.isIntersecting) {
            const el = e.target
            el.classList.add('muncul')
            io.unobserve(el)
            // Setelah selesai, bersihkan supaya efek hover kartu kembali normal
            setTimeout(() => {
              el.classList.remove('akan-muncul', 'muncul')
              el.style.transitionDelay = ''
            }, 800)
          }
        }
      },
      { rootMargin: '0px 0px -32px 0px', threshold: 0.04 },
    )
    const tandai = () => {
      let urut = 0
      akar.querySelectorAll('.rounded-card:not([data-muncul])').forEach((el) => {
        el.dataset.muncul = '1' // hanya dianimasikan sekali
        if (el.closest('dialog') || el.parentElement?.closest('.akan-muncul')) return
        el.classList.add('akan-muncul')
        el.style.transitionDelay = `${Math.min(urut++, 5) * 45}ms`
        io.observe(el)
      })
    }
    tandai()
    const mo = new MutationObserver(tandai)
    mo.observe(akar, { childList: true, subtree: true })
    return () => {
      mo.disconnect()
      io.disconnect()
    }
  }, [ref])
}

function isActive(pathname, path) {
  return path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(`${path}/`)
}

// ---------------------------------------------------------------------------
// Sidebar (laptop, >= 1024 px)
// ---------------------------------------------------------------------------
function Sidebar() {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const menus = visibleMenus(profile.role)

  return (
    <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col border-r border-line bg-surface lg:flex">
      <div className="px-5 pt-6 pb-4">
        <Brand />
      </div>
      <nav aria-label="Menu utama" className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-1">
          {menus.map((m) => {
            const Icon = m.icon
            const active = isActive(pathname, m.path)
            return (
              <li key={m.key}>
                <Link
                  to={m.path}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-12 items-center gap-3 rounded-field px-4 text-[17px] font-bold transition-colors ${
                    active ? 'bg-primary-soft text-primary' : 'text-ink hover:bg-soft'
                  }`}
                >
                  <Icon aria-hidden="true" className="size-6 shrink-0" />
                  {m.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="border-t border-line p-3">
        <Link to="/profil" className="flex items-center gap-3 rounded-field p-2 hover:bg-soft">
          <Avatar name={profile.full_name} path={profile.avatar_path} />
          <span className="min-w-0">
            <span className="block truncate font-extrabold">{profile.full_name}</span>
            <span className="block truncate text-base text-muted">{ROLE_LABELS[profile.role]}</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="mt-1 flex min-h-12 w-full items-center gap-3 rounded-field px-4 font-bold text-muted hover:bg-soft hover:text-ink"
        >
          <LogOut aria-hidden="true" className="size-6" /> Keluar
        </button>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Bar atas
// ---------------------------------------------------------------------------
function TopBar({ title }) {
  const { profile } = useAuth()
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/85">
      <div className="mx-auto flex h-18 max-w-5xl items-center gap-3 px-4 lg:px-8">
        <Link to="/" aria-label="Ke Beranda" className="lg:hidden">
          <Brand withText={false} />
        </Link>
        <p className="min-w-0 flex-1 truncate text-xl font-extrabold">{title}</p>
        <NotificationBell />
        <Link to="/profil" aria-label="Profil saya" className="rounded-full lg:hidden">
          <Avatar name={profile.full_name} path={profile.avatar_path} />
        </Link>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// Navigasi bawah (HP): 4 menu sesuai peran + Lainnya
// ---------------------------------------------------------------------------
function BottomNav() {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  const items = bottomNavMenus(profile.role)
  const lainnyaAktif = !items.some((m) => isActive(pathname, m.path))

  const itemCls = (active) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 text-base ${
      active ? 'font-extrabold text-primary' : 'font-semibold text-muted'
    }`
  const pillCls = (active) => `grid h-8 w-14 place-items-center rounded-full ${active ? 'bg-primary-soft' : ''}`

  return (
    <nav
      aria-label="Menu utama"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-safe lg:hidden"
    >
      <div className="mx-auto flex h-19 max-w-xl">
        {items.map((m) => {
          const Icon = m.icon
          const active = isActive(pathname, m.path)
          return (
            <NavLink key={m.key} to={m.path} aria-current={active ? 'page' : undefined} className={itemCls(active)}>
              <span className={pillCls(active)}>
                <Icon aria-hidden="true" className="size-6" />
              </span>
              {m.short}
            </NavLink>
          )
        })}
        <NavLink to="/lainnya" aria-current={lainnyaAktif ? 'page' : undefined} className={itemCls(lainnyaAktif)}>
          <span className={pillCls(lainnyaAktif)}>
            <Menu aria-hidden="true" className="size-6" />
          </span>
          Lainnya
        </NavLink>
      </div>
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Pemberitahuan status akun (menunggu persetujuan / belum terhubung ke pasien)
// ---------------------------------------------------------------------------
function StatusAkunBanner() {
  const { profile } = useAuth()
  if (profile.approval_status === 'menunggu') {
    return (
      <Banner tone="warning" title="Akun Anda menunggu persetujuan Admin" className="mb-5">
        Sementara ini Anda hanya bisa melihat info umum. Tombol tambah dan ubah akan muncul setelah akun disetujui.
      </Banner>
    )
  }
  if (profile.approval_status === 'ditolak') {
    return (
      <Banner tone="danger" title="Pendaftaran akun Anda tidak disetujui" className="mb-5">
        Hubungi koordinator Puskesmas atau Admin jika ini keliru.
      </Banner>
    )
  }
  if (profile.role === 'pasien' && !profile.patient_id) {
    return (
      <Banner tone="info" title="Akun belum terhubung ke data pasien" className="mb-5">
        Minta Perawat atau Kader untuk menghubungkan akun ini ke data pasien, supaya riwayat perawatan bisa terlihat.
      </Banner>
    )
  }
  return null
}

export function AppLayout() {
  const title = usePageTitle()
  const { pathname } = useLocation()
  const kontenRef = useRef(null)
  useMunculSaatScroll(kontenRef)
  // Kembali ke atas saat pindah halaman
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])
  return (
    <div className="min-h-dvh lg:flex">
      <a
        href="#konten"
        className="sr-only z-50 rounded-field bg-primary px-4 py-3 font-bold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Langsung ke isi halaman
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} />
        <main ref={kontenRef} id="konten" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-32 lg:px-8 lg:pt-8 lg:pb-12">
          <StatusAkunBanner />
          {/* key = alamat halaman -> animasi masuk setiap pindah halaman */}
          <div key={pathname} className="animasi-halaman">
            <Suspense fallback={<Spinner />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
