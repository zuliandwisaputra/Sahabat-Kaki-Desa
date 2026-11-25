import { useAuth } from '../context/AuthContext'
import { can } from '../lib/permissions'

/**
 * Tampilkan isi hanya untuk peran yang berwenang (PRD bagian 4).
 * Contoh: <Can do="pasien.tambah"><Button>Tambah pasien</Button></Can>
 * Ingat: ini hanya menyembunyikan tombol. Penolakan sebenarnya ada di RLS database.
 */
export function Can({ do: action, children, fallback = null }) {
  const { profile } = useAuth()
  return can(profile, action) ? children : fallback
}

export function useCan(action) {
  const { profile } = useAuth()
  return can(profile, action)
}
