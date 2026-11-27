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
const Kuesioner = lazy(() => import('./pages/kuesioner/Kuesioner'))
const Evaluasi = lazy(() => import('./pages/evaluasi/Evaluasi'))
const KelolaData = lazy(() => import('./pages/kelola-data/KelolaData'))
const DaftarPasien = lazy(() => import('./pages/pasien/DaftarPasien'))
const FormPasien = lazy(() => import('./pages/pasien/FormPasien'))
const DetailPasien = lazy(() => import('./pages/pasien/DetailPasien'))
const SahabatKaki = lazy(() => import('./pages/sahabat-kaki/SahabatKaki'))
const DaftarKartu = lazy(() => import('./pages/kartu-kaki/DaftarKartu'))
const FormKartu = lazy(() => import('./pages/kartu-kaki/FormKartu'))
const DetailKartu = lazy(() => import('./pages/kartu-kaki/DetailKartu'))
const Jimpitan = lazy(() => import('./pages/jimpitan/Jimpitan'))
const PosKaki = lazy(() => import('./pages/pos-kaki/PosKaki'))
const AgendaDetail = lazy(() => import('./pages/pos-kaki/AgendaDetail'))
const Pemberdayaan = lazy(() => import('./pages/pemberdayaan/Pemberdayaan'))
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
          {
            path: 'pasien',
            handle: { title: 'Pasien', menu: 'pasien' },
            children: [
              { index: true, element: <DaftarPasien /> },
              { path: 'baru', handle: { title: 'Tambah pasien' }, element: <FormPasien key="baru" /> },
              { path: ':id', handle: { title: 'Detail pasien' }, element: <DetailPasien /> },
              { path: ':id/ubah', handle: { title: 'Ubah data pasien' }, element: <FormPasien key="ubah" /> },
            ],
          },
          { path: 'sahabat-kaki', handle: { title: 'Sahabat Kaki', menu: 'sahabat-kaki' }, element: <SahabatKaki /> },
          {
            path: 'kartu-kaki',
            handle: { title: 'Kartu Kaki Sehat', menu: 'kartu-kaki' },
            children: [
              { index: true, element: <DaftarKartu /> },
              { path: 'baru', handle: { title: 'Isi Kartu Kaki' }, element: <FormKartu key="baru" /> },
              { path: ':id', handle: { title: 'Kartu Kaki Sehat' }, element: <DetailKartu /> },
              { path: ':id/ubah', handle: { title: 'Ubah catatan kartu' }, element: <FormKartu key="ubah" /> },
            ],
          },
          { path: 'jimpitan', handle: { title: 'Jimpitan Sehat', menu: 'jimpitan' }, element: <Jimpitan /> },
          {
            path: 'pos-kaki',
            handle: { title: 'Pos Kaki & Ojek Sehat', menu: 'pos-kaki' },
            children: [
              { index: true, element: <PosKaki /> },
              { path: 'agenda/:id', handle: { title: 'Agenda Pos Kaki' }, element: <AgendaDetail /> },
            ],
          },
          { path: 'pemberdayaan', handle: { title: 'Pemberdayaan Desa', menu: 'pemberdayaan' }, element: <Pemberdayaan /> },
          { path: 'kuesioner', handle: { title: 'Kuesioner', menu: 'kuesioner' }, element: <Kuesioner /> },
          { path: 'evaluasi', handle: { title: 'Evaluasi', menu: 'evaluasi' }, element: <Evaluasi /> },
          { path: 'kelola-data', handle: { title: 'Kelola Data', menu: 'kelola-data' }, element: <KelolaData /> },
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
