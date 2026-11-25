// Semua waktu ditampilkan dalam WIB (Asia/Jakarta)
const TZ = 'Asia/Jakarta'

function toDate(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "Kamis, 3 Desember 2026" (pakai {weekday:undefined} untuk tanpa hari) */
export function formatTanggal(value, options = {}) {
  const d = toDate(value)
  if (!d) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    ...options,
  }).format(d)
}

/** "3 Des 2026" */
export function formatTanggalPendek(value) {
  return formatTanggal(value, { weekday: undefined, month: 'short' })
}

/** "08:00:00" -> "08.00" */
export function formatJam(time) {
  if (!time) return ''
  const [h, m] = String(time).split(':')
  return `${h.padStart(2, '0')}.${(m ?? '00').padStart(2, '0')}`
}

/** 850000 -> "Rp850.000" */
export function formatRupiah(value) {
  const n = Number(value ?? 0)
  const s = new Intl.NumberFormat('id-ID').format(Math.abs(n))
  return `${n < 0 ? '-' : ''}Rp${s}`
}

export function formatAngka(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value ?? 0))
}

/** "5 menit lalu", "kemarin", atau tanggal */
export function waktuRelatif(value) {
  const d = toDate(value)
  if (!d) return ''
  const detik = Math.round((Date.now() - d.getTime()) / 1000)
  if (detik < 60) return 'baru saja'
  const menit = Math.round(detik / 60)
  if (menit < 60) return `${menit} menit lalu`
  const jam = Math.round(menit / 60)
  if (jam < 24) return `${jam} jam lalu`
  const hari = Math.round(jam / 24)
  if (hari === 1) return 'kemarin'
  if (hari < 7) return `${hari} hari lalu`
  return formatTanggalPendek(d)
}

/** Salam sesuai jam WIB */
export function salam() {
  const jam = Number(
    new Intl.DateTimeFormat('id-ID', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(new Date()),
  )
  if (jam >= 4 && jam < 11) return 'Selamat pagi'
  if (jam >= 11 && jam < 15) return 'Selamat siang'
  if (jam >= 15 && jam < 18) return 'Selamat sore'
  return 'Selamat malam'
}

/** "Ny. Siti Aminah" -> "SA" */
export function inisial(nama) {
  const kata = String(nama ?? '')
    .replace(/^(ny|tn|nn|an|ns|bd|dr)\.\s*/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (kata.length === 0) return '?'
  return (kata[0][0] + (kata[1]?.[0] ?? '')).toUpperCase()
}

/** Tanggal hari ini (WIB) dalam format YYYY-MM-DD */
export function hariIniWIB() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}
