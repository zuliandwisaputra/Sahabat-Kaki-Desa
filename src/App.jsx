import { lazy, Suspense } from 'react'
import { createBrowserRouter, Outlet, RouterProvider, useRouteError } from 'react-router'
import { RefreshCw } from 'lucide-react'
import { supabaseConfigured } from './lib/supabase'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { PublicOnly, RequireAuth, RequireMenu, SplashScreen } from './components/RequireAuth'
import { AppLayout } from './components/layout/AppLayout'
import { Button } from './components/ui/Button'
import Masuk from './pages/auth/Masuk'
import SetupDiperlukan from './pages/umum/SetupDiperlukan'

// Halaman dimuat saat dibutuhkan saja, supaya halaman pertama cepat terbuka di HP
const Daftar = lazy(() => import('./pages/auth/Daftar'))
const LupaPassword = lazy(() => import('./pages/auth/LupaPassword'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'))
const Beranda = lazy(() => import('./pages/beranda/Beranda'))
const Profil = lazy(() => import('./pages/profil/Profil'))
const KelolaAkun = lazy(() => import('./pages/kelola-akun/KelolaAkun'))
const Lainnya = lazy(() => import('./pages/umum/Lainnya'))
const ModulDisiapkan = lazy(() => import('./pages/umum/ModulDisiapkan'))
const NotFound = lazy(() => import('./pages/umum/NotFound'))

function Root() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Suspense fallback={<SplashScreen />}>
          <Outlet />
        </Suspense>
      </AuthProvider>
    </ToastProvider>
  )
}

function RouteError() {
  const error = useRouteError()
  console.error(error)
  return (
    <div className="grid min-h-dvh place-items-center bg-hero px-6 text-center">
      <div className="max-w-sm">
        <p className="text-2xl font-extrabold">Halaman gagal dimuat</p>
        <p className="mt-2 text-muted">Mungkin sinyal internet sedang lemah. Coba muat ulang halaman.</p>
        <Button className="mt-5" icon={RefreshCw} onClick={() => window.location.reload()} block>
          Muat ulang
        </Button>
      </div>
    </div>
  )
}

// Modul yang dibangun di tahap berikutnya (sementara menampilkan "sedang disiapkan")
const modul = (key, title) => ({
  path: `${key}/*`,
  handle: { title, menu: key },
  element: <ModulDisiapkan />,
})

const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      { path: 'masuk', element: <PublicOnly><Masuk /></PublicOnly> },
      { path: 'daftar', element: <PublicOnly><Daftar /></PublicOnly> },
      { path: 'lupa-password', element: <PublicOnly><LupaPassword /></PublicOnly> },
      { path: 'reset-password', element: <ResetPassword /> },
      {
        path: '/',
        element: (
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        ),
        children: [
          { index: true, handle: { title: 'Beranda' }, element: <Beranda /> },
          { path: 'profil', handle: { title: 'Profil' }, element: <Profil /> },
          { path: 'lainnya', handle: { title: 'Lainnya' }, element: <Lainnya /> },
          {
            path: 'kelola-akun',
            handle: { title: 'Kelola Akun', menu: 'kelola-akun' },
            element: (
              <RequireMenu menu="kelola-akun">
                <KelolaAkun />
              </RequireMenu>
            ),
          },
          modul('pasien', 'Pasien'),
          modul('sahabat-kaki', 'Sahabat Kaki'),
          modul('kartu-kaki', 'Kartu Kaki Sehat'),
          modul('jimpitan', 'Jimpitan Sehat'),
          modul('pos-kaki', 'Pos Kaki & Ojek Sehat'),
          modul('pemberdayaan', 'Pemberdayaan Desa'),
          modul('kuesioner', 'Kuesioner'),
          modul('evaluasi', 'Evaluasi'),
          modul('kelola-data', 'Kelola Data'),
          { path: '*', handle: { title: 'Tidak ditemukan' }, element: <NotFound /> },
        ],
      },
    ],
  },
])

export default function App() {
  if (!supabaseConfigured) return <SetupDiperlukan />
  return <RouterProvider router={router} />
}
