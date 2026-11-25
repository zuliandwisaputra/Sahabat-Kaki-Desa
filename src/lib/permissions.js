import {
  ChartColumn,
  ClipboardCheck,
  ClipboardList,
  Database,
  HandHeart,
  House,
  MapPin,
  Sprout,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react'

// =============================================================================
// Matriks hak akses — PRD bagian 4 + docs/KEPUTUSAN.md
// Ini lapis TAMPILAN (menyembunyikan tombol). Lapis yang sebenarnya menolak
// perubahan adalah RLS di database (supabase/migrations/..._rls.sql).
// =============================================================================

export const ROLE_LABELS = {
  perawat: 'Perawat Puskesmas',
  kader: 'Kader',
  pasien: 'Pasien/Keluarga',
  desa: 'Perangkat Desa',
  admin: 'Admin',
}

// Peran yang bisa dipilih saat Daftar (Admin tidak bisa dipilih)
export const REGISTER_ROLES = [
  {
    value: 'perawat',
    label: 'Perawat Puskesmas',
    desc: 'Menilai kondisi kaki, menulis SBAR, memberi arahan dan rujukan.',
    needsApproval: true,
  },
  {
    value: 'kader',
    label: 'Kader',
    desc: 'Mendaftarkan pasien, mendampingi, mengisi Kartu Kaki Sehat.',
    needsApproval: true,
  },
  {
    value: 'pasien',
    label: 'Pasien/Keluarga',
    desc: 'Melihat progres perawatan, jadwal, dan edukasi.',
    needsApproval: false,
  },
  {
    value: 'desa',
    label: 'Perangkat Desa',
    desc: 'Mengelola Jimpitan Sehat dan dukungan desa.',
    needsApproval: true,
  },
]

// Tingkat akses per menu: 'edit' | 'terbatas' | 'lihat' | 'rekap' | 'sendiri' | null (tidak tampil)
const MATRIX = {
  beranda: { perawat: 'edit', kader: 'edit', pasien: 'lihat', desa: 'edit', admin: 'edit' },
  pasien: { perawat: 'edit', kader: 'edit', pasien: 'terbatas', desa: 'lihat', admin: 'edit' },
  'sahabat-kaki': { perawat: 'edit', kader: 'terbatas', pasien: 'lihat', desa: 'lihat', admin: 'edit' },
  'kartu-kaki': { perawat: 'edit', kader: 'edit', pasien: 'lihat', desa: 'lihat', admin: 'edit' },
  jimpitan: { perawat: 'edit', kader: 'edit', pasien: 'lihat', desa: 'edit', admin: 'edit' },
  'pos-kaki': { perawat: 'edit', kader: 'edit', pasien: 'lihat', desa: 'lihat', admin: 'edit' },
  pemberdayaan: { perawat: 'edit', kader: 'edit', pasien: 'terbatas', desa: 'edit', admin: 'edit' },
  kuesioner: { perawat: 'edit', kader: 'rekap', pasien: 'sendiri', desa: 'rekap', admin: 'edit' },
  evaluasi: { perawat: 'edit', kader: 'lihat', pasien: 'lihat', desa: 'lihat', admin: 'edit' },
  'kelola-data': { perawat: 'edit', kader: 'lihat', pasien: 'lihat', desa: 'lihat', admin: 'edit' },
  'kelola-akun': { perawat: 'lihat', kader: null, pasien: null, desa: null, admin: 'edit' },
}

export const MENUS = [
  { key: 'beranda', path: '/', label: 'Beranda', short: 'Beranda', icon: House },
  { key: 'pasien', path: '/pasien', label: 'Pasien', short: 'Pasien', icon: Users },
  { key: 'sahabat-kaki', path: '/sahabat-kaki', label: 'Sahabat Kaki', short: 'Sahabat', icon: HandHeart },
  { key: 'kartu-kaki', path: '/kartu-kaki', label: 'Kartu Kaki Sehat', short: 'Kartu', icon: ClipboardList },
  { key: 'jimpitan', path: '/jimpitan', label: 'Jimpitan Sehat', short: 'Jimpitan', icon: Wallet },
  { key: 'pos-kaki', path: '/pos-kaki', label: 'Pos Kaki & Ojek Sehat', short: 'Pos Kaki', icon: MapPin },
  { key: 'pemberdayaan', path: '/pemberdayaan', label: 'Pemberdayaan Desa', short: 'Kegiatan', icon: Sprout },
  { key: 'kuesioner', path: '/kuesioner', label: 'Kuesioner', short: 'Kuesioner', icon: ClipboardCheck },
  { key: 'evaluasi', path: '/evaluasi', label: 'Evaluasi', short: 'Evaluasi', icon: ChartColumn },
  { key: 'kelola-data', path: '/kelola-data', label: 'Kelola Data', short: 'Data', icon: Database },
  { key: 'kelola-akun', path: '/kelola-akun', label: 'Kelola Akun', short: 'Akun', icon: UserCog },
]

// 4 menu utama di navigasi bawah HP (ditambah "Lainnya"), sesuai tugas tiap peran
const BOTTOM_NAV = {
  perawat: ['beranda', 'pasien', 'kartu-kaki', 'pos-kaki'],
  kader: ['beranda', 'pasien', 'sahabat-kaki', 'kartu-kaki'],
  pasien: ['beranda', 'kartu-kaki', 'pos-kaki', 'pemberdayaan'],
  desa: ['beranda', 'jimpitan', 'pemberdayaan', 'pos-kaki'],
  admin: ['beranda', 'pasien', 'kelola-akun', 'kelola-data'],
}

// Tindakan tertentu (tombol tambah/ubah/hapus) dan peran yang boleh melakukannya
const ACTIONS = {
  'beranda.artikel': ['perawat', 'kader', 'desa', 'admin'],
  'pasien.tambah': ['perawat', 'kader', 'admin'],
  'pasien.ubah': ['perawat', 'kader', 'admin'],
  'pasien.arsip': ['perawat', 'admin'],
  'pasien.hapus-permanen': ['admin'],
  'pasien.hubungkan-akun': ['perawat', 'kader', 'admin'],
  'sahabat.pasangkan': ['perawat', 'admin'],
  'sahabat.catat-kunjungan': ['perawat', 'kader', 'admin'],
  'kartu.catat': ['perawat', 'kader', 'admin'],
  'kartu.kode-warna': ['perawat', 'admin'],
  'kartu.tindak-lanjut': ['perawat', 'kader', 'admin'],
  'jimpitan.catat': ['perawat', 'kader', 'desa', 'admin'],
  'pos.kelola': ['perawat', 'kader', 'admin'],
  'pemberdayaan.kelola': ['perawat', 'kader', 'desa', 'admin'],
  'kuesioner.isi': ['perawat', 'admin'],
  'evaluasi.catatan': ['perawat', 'admin'],
  'data.kelola': ['perawat', 'admin'],
  'akun.kelola': ['admin'],
}

export function isApproved(profile) {
  return profile?.approval_status === 'disetujui'
}

/** Tingkat akses menu untuk peran ini (tanpa melihat status persetujuan). */
export function menuAccess(role, menuKey) {
  return MATRIX[menuKey]?.[role] ?? null
}

/** Menu yang tampil untuk peran ini. Semua menu tampil, kecuali Kelola Akun. */
export function visibleMenus(role) {
  return MENUS.filter((m) => menuAccess(role, m.key) !== null)
}

export function bottomNavMenus(role) {
  const keys = BOTTOM_NAV[role] ?? BOTTOM_NAV.pasien
  return keys.map((k) => MENUS.find((m) => m.key === k))
}

/** Boleh melakukan tindakan ini? Akun harus sudah disetujui. */
export function can(profile, action) {
  if (!isApproved(profile)) return false
  return (ACTIONS[action] ?? []).includes(profile.role)
}

/** Teks singkat untuk lencana hak akses di judul halaman. */
export function accessLabel(profile, menuKey) {
  const level = menuAccess(profile?.role, menuKey)
  if (!level) return null
  if (!isApproved(profile) && level !== 'lihat') return { text: 'Menunggu persetujuan', tone: 'warning' }
  switch (level) {
    case 'edit':
      return { text: 'Anda bisa mengubah', tone: 'primary' }
    case 'terbatas':
      return { text: 'Bisa mengubah sebagian', tone: 'primary' }
    case 'rekap':
      return { text: 'Melihat rekap', tone: 'neutral' }
    case 'sendiri':
      return { text: 'Melihat data sendiri', tone: 'neutral' }
    default:
      return { text: 'Hanya melihat', tone: 'neutral' }
  }
}
