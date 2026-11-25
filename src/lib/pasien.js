// Label & fungsi bantu untuk modul Pasien, Sahabat Kaki, dan Kartu Kaki Sehat.
import { hariIniWIB } from './format'

export const STATUS_PASIEN = {
  aktif: { label: 'Aktif', tone: 'success' },
  rujukan: { label: 'Rujukan', tone: 'danger' },
  selesai: { label: 'Selesai', tone: 'neutral' },
}

export const HAMBATAN = {
  transportasi: 'Transportasi',
  ekonomi: 'Ekonomi',
  dukungan_keluarga: 'Dukungan keluarga',
  lainnya: 'Lainnya',
}

export const JENIS_KUNJUNGAN = {
  kunjungan_rumah: 'Kunjungan rumah',
  menemani_kontrol: 'Menemani kontrol',
  telepon: 'Telepon',
}

export const PERUBAHAN = {
  tidak_ada: 'Tidak ada perubahan',
  membaik: 'Membaik',
  memburuk: 'Memburuk',
}

export const TANDA = {
  kemerahan: 'Kemerahan',
  bengkak: 'Bengkak',
  demam: 'Demam',
  bau: 'Bau',
  nyeri: 'Nyeri',
}

// KKS-06: Draft -> Dikirim kader -> Dinilai perawat -> Ditindaklanjuti
export const STATUS_KARTU = {
  draft: { label: 'Draft', tone: 'neutral' },
  dikirim: { label: 'Dikirim kader', tone: 'warning' },
  dinilai: { label: 'Dinilai perawat', tone: 'primary' },
  ditindaklanjuti: { label: 'Ditindaklanjuti', tone: 'success' },
}
export const URUTAN_STATUS_KARTU = ['draft', 'dikirim', 'dinilai', 'ditindaklanjuti']

export const JENIS_PENDAMPING = { kader: 'Kader', pkk: 'Anggota PKK', lainnya: 'Lainnya' }

/** Umur dalam tahun dari tanggal lahir (YYYY-MM-DD). */
export function umur(birthDate) {
  if (!birthDate) return null
  const [y, m, d] = birthDate.split('-').map(Number)
  const [ty, tm, td] = hariIniWIB().split('-').map(Number)
  let u = ty - y
  if (tm < m || (tm === m && td < d)) u -= 1
  return u
}

/** Selisih hari dari tanggal (YYYY-MM-DD) sampai hari ini (WIB). */
export function selisihHari(tanggal) {
  if (!tanggal) return null
  const a = Date.UTC(...tanggal.split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))))
  const b = Date.UTC(...hariIniWIB().split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))))
  return Math.round((b - a) / 86_400_000)
}

/** Awal minggu ini (Senin) dalam WIB, format YYYY-MM-DD. */
export function awalMingguIni() {
  const [y, m, d] = hariIniWIB().split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  const hari = (t.getUTCDay() + 6) % 7 // Senin = 0
  t.setUTCDate(t.getUTCDate() - hari)
  return t.toISOString().slice(0, 10)
}

/** "0812-3456" -> "6281234..." untuk tautan wa.me */
export function nomorWA(phone) {
  if (!phone) return null
  let n = String(phone).replace(/[^0-9]/g, '')
  if (n.startsWith('0')) n = `62${n.slice(1)}`
  if (!n.startsWith('62')) return null
  return n
}

export function linkWA(phone, pesan) {
  const n = nomorWA(phone)
  if (!n) return null
  return `https://wa.me/${n}${pesan ? `?text=${encodeURIComponent(pesan)}` : ''}`
}

export function alamatSingkat(p) {
  if (!p) return '-'
  return [p.dusun && `Dusun ${p.dusun}`, p.rt && `RT ${p.rt}`, p.rw && `RW ${p.rw}`].filter(Boolean).join(', ') || '-'
}

/** Penilaian dari embed PostgREST bisa berupa objek atau array — ambil satu. */
export function satuPenilaian(a) {
  if (!a) return null
  return Array.isArray(a) ? (a[0] ?? null) : a
}

/** Peta id -> baris */
export function petaId(rows) {
  return Object.fromEntries((rows ?? []).map((r) => [r.id, r]))
}
