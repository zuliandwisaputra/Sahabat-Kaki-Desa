import { useAuth } from '../context/AuthContext'
import { supabase } from './supabase'
import { petaId } from './pasien'
import { pesanError } from './errors'

/** Ringkasan peran pengguna yang login (status persetujuan sudah diperhitungkan). */
export function usePeran() {
  const { profile, approved } = useAuth()
  const role = profile.role
  return {
    profile,
    role,
    approved,
    klinis: approved && ['perawat', 'kader', 'admin'].includes(role),
    desa: approved && role === 'desa',
    sendiri: approved && role === 'pasien' && Boolean(profile.patient_id),
    staf: approved && ['perawat', 'kader', 'desa', 'admin'].includes(role),
  }
}

/** Peta id -> {full_name, rt, dusun} pasien yang boleh dibaca peran ini. */
export async function muatNamaPasien(peran) {
  if (peran.klinis || peran.sendiri) {
    const { data } = await supabase.from('patients').select('id, full_name, rt, dusun, rw, address_detail, archived_at').order('full_name')
    return petaId(data)
  }
  if (peran.desa) {
    const { data } = await supabase.from('patient_directory').select('id, full_name, rt, dusun, rw, archived_at').order('full_name')
    return petaId(data)
  }
  return {}
}

/** Jalankan query Supabase; lempar Error berbahasa Indonesia bila gagal. */
export async function jalankan(query) {
  const { data, error } = await query
  if (error) throw new Error(pesanError(error))
  return data
}
