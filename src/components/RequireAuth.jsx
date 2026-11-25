import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { menuAccess } from '../lib/permissions'
import { Brand } from './layout/Brand'
import { Button } from './ui/Button'
import { Spinner } from './ui/misc'

export function SplashScreen() {
  return (
    <div className="grid min-h-dvh place-items-center bg-hero px-6">
      <div className="flex flex-col items-center gap-4">
        <Brand size="lg" />
        <Spinner label="Menyiapkan…" className="py-2" />
      </div>
    </div>
  )
}

/** AUTH-01: halaman mana pun dialihkan ke Masuk jika belum login. */
export function RequireAuth({ children }) {
  const { session, profile, loading, signOut } = useAuth()
  const location = useLocation()

  if (loading) return <SplashScreen />
  if (!session) return <Navigate to="/masuk" replace state={{ from: location }} />
  if (!profile) {
    return (
      <div className="grid min-h-dvh place-items-center bg-hero px-6">
        <div className="max-w-sm text-center">
          <Brand size="lg" />
          <p className="mt-6 text-lg font-bold">Profil akun tidak ditemukan.</p>
          <p className="mt-1 text-muted">Hubungi Admin untuk memeriksa akun Anda, lalu masuk lagi.</p>
          <Button className="mt-5" onClick={signOut} block>
            Keluar
          </Button>
        </div>
      </div>
    )
  }
  return children
}

/** Halaman Masuk/Daftar/Lupa password: jika sudah login, langsung ke Beranda. */
export function PublicOnly({ children }) {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <SplashScreen />
  if (session) return <Navigate to={location.state?.from?.pathname ?? '/'} replace />
  return children
}

/** Menu yang tidak tampil untuk peran ini (mis. Kelola Akun untuk Kader). */
export function RequireMenu({ menu, children }) {
  const { role } = useAuth()
  if (menuAccess(role, menu) === null) return <Navigate to="/" replace />
  return children
}
