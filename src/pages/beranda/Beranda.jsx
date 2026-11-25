import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  CalendarDays,
  ChartColumn,
  ChevronRight,
  ClipboardList,
  Database,
  HandHeart,
  MapPin,
  Sprout,
  TriangleAlert,
  UserCog,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { ROLE_LABELS } from '../../lib/permissions'
import { formatAngka, formatJam, formatRupiah, formatTanggal, formatTanggalPendek, salam } from '../../lib/format'
import { Badge, CodeBadge, EmptyState } from '../../components/ui/misc'
import { ArtikelSection } from './ArtikelSection'

// HOME-01: sambutan & pintasan berbeda untuk setiap peran
const PESAN_PERAN = {
  perawat: 'Nilai Kartu Kaki Sehat yang masuk dan beri arahan untuk kader.',
  kader: 'Terima kasih sudah mendampingi warga. Jangan lupa kunjungan mingguan.',
  pasien: 'Semoga lekas pulih. Lihat jadwal kontrol dan cara merawat kaki di sini.',
  desa: 'Pantau dana Jimpitan Sehat dan dukung kegiatan warga desa.',
  admin: 'Setujui akun baru dan jaga data program tetap rapi.',
}

const PINTASAN = {
  perawat: [
    { to: '/kartu-kaki', label: 'Nilai Kartu Kaki', icon: ClipboardList },
    { to: '/pasien', label: 'Daftar pasien', icon: Users },
    { to: '/pos-kaki', label: 'Jadwal Pos Kaki', icon: MapPin },
    { to: '/evaluasi', label: 'Evaluasi', icon: ChartColumn },
  ],
  kader: [
    { to: '/sahabat-kaki', label: 'Catat kunjungan', icon: HandHeart },
    { to: '/kartu-kaki', label: 'Isi Kartu Kaki', icon: ClipboardList },
    { to: '/pasien', label: 'Daftarkan pasien', icon: Users },
    { to: '/pos-kaki', label: 'Pos Kaki & Ojek', icon: MapPin },
  ],
  pasien: [
    { to: '/kartu-kaki', label: 'Kartu Kaki saya', icon: ClipboardList },
    { to: '/pos-kaki', label: 'Jadwal Pos Kaki', icon: MapPin },
    { to: '/pemberdayaan', label: 'Kegiatan desa', icon: Sprout },
    { to: '/profil', label: 'Profil saya', icon: UserRound },
  ],
  desa: [
    { to: '/jimpitan', label: 'Catat Jimpitan', icon: Wallet },
    { to: '/pemberdayaan', label: 'Kegiatan desa', icon: Sprout },
    { to: '/pos-kaki', label: 'Jadwal Pos Kaki', icon: MapPin },
    { to: '/evaluasi', label: 'Evaluasi', icon: ChartColumn },
  ],
  admin: [
    { to: '/kelola-akun', label: 'Kelola Akun', icon: UserCog },
    { to: '/kelola-data', label: 'Kelola Data', icon: Database },
    { to: '/pasien', label: 'Daftar pasien', icon: Users },
    { to: '/evaluasi', label: 'Evaluasi', icon: ChartColumn },
  ],
}

function Sambutan({ profile, stats, akunMenunggu }) {
  let info = PESAN_PERAN[profile.role]
  if (profile.role === 'perawat' && stats) {
    info = `${formatAngka(stats.kartu_menunggu_penilaian)} kartu menunggu penilaian, ${formatAngka(
      stats.tanda_bahaya_belum_ditindaklanjuti,
    )} tanda bahaya belum ditindaklanjuti.`
  }
  if (profile.role === 'admin' && akunMenunggu !== null) {
    info = akunMenunggu > 0 ? `${akunMenunggu} akun menunggu persetujuan Anda.` : PESAN_PERAN.admin
  }
  return (
    <section className="-mx-4 -mt-5 bg-hero px-4 pt-5 pb-6 lg:mx-0 lg:mt-0 lg:rounded-card lg:border lg:border-line lg:px-7 lg:py-7">
      <p className="text-muted">{salam()},</p>
      <h1 className="text-[28px] leading-tight font-extrabold">{profile.full_name}</h1>
      <Badge tone="primary" className="mt-2">
        {ROLE_LABELS[profile.role]}
      </Badge>
      <p className="mt-3 text-lg">{info}</p>
      {profile.role === 'admin' && akunMenunggu > 0 && (
        <Link
          to="/kelola-akun"
          className="mt-3 inline-flex min-h-11 items-center gap-1 font-bold text-primary underline underline-offset-4"
        >
          Buka Kelola Akun <ChevronRight aria-hidden="true" className="size-5" />
        </Link>
      )}
    </section>
  )
}

/** P1 "Tanda bahaya otomatis": kartu merah/kuning paling atas di beranda petugas. */
function PerluPerhatian({ role }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let aktif = true
    ;(async () => {
      const { data: kartu } = await supabase
        .from('foot_card_summary')
        .select('id, patient_id, visit_date, status, color_code')
        .or('status.eq.dikirim,and(status.eq.dinilai,color_code.in.(kuning,merah))')
        .order('visit_date', { ascending: false })
        .limit(30)
      const ids = [...new Set((kartu ?? []).map((k) => k.patient_id))]
      let nama = {}
      if (ids.length) {
        const { data: pasien } = await supabase.from('patient_directory').select('id, full_name, rt, dusun').in('id', ids)
        nama = Object.fromEntries((pasien ?? []).map((p) => [p.id, p]))
      }
      const urutan = { merah: 0, kuning: 1 }
      const hasil = (kartu ?? [])
        .map((k) => ({ ...k, pasien: nama[k.patient_id] }))
        .sort((a, b) => (urutan[a.color_code] ?? 2) - (urutan[b.color_code] ?? 2))
        .slice(0, 5)
      if (aktif) setRows(hasil)
    })()
    return () => {
      aktif = false
    }
  }, [])

  if (rows === null) return null
  return (
    <section aria-labelledby="perhatian">
      <h2 id="perhatian" className="mb-3 flex items-center gap-2 text-xl font-extrabold">
        <TriangleAlert aria-hidden="true" className="size-6 text-danger" /> Perlu perhatian
      </h2>
      {rows.length === 0 ? (
        <EmptyState title="Tidak ada tanda bahaya">Semua kartu sudah dinilai dan ditindaklanjuti.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-card border-2 border-merah-line/70 bg-surface shadow-card">
          <ul>
            {rows.map((r) => (
              <li key={r.id} className="border-b border-line last:border-0">
                <Link to={`/kartu-kaki/${r.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-soft/60">
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg leading-snug font-extrabold">{r.pasien?.full_name ?? 'Pasien'}</span>
                    <span className="block text-muted">
                      RT {r.pasien?.rt ?? '-'} · {formatTanggalPendek(r.visit_date)} ·{' '}
                      {r.status === 'dikirim'
                        ? 'menunggu penilaian'
                        : role === 'kader'
                          ? 'perlu ditindaklanjuti'
                          : 'belum ditindaklanjuti'}
                    </span>
                  </span>
                  <CodeBadge code={r.color_code} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function StatCard({ to, icon: Icon, value, label, wide }) {
  return (
    <Link
      to={to}
      className={`flex rounded-card border border-line bg-surface p-4 shadow-card transition-colors hover:border-primary/40 ${
        wide ? 'col-span-2 items-center gap-3' : 'flex-col'
      }`}
    >
      <span className={`grid size-11 shrink-0 place-items-center rounded-2xl bg-soft text-primary ${wide ? '' : 'mb-2'}`}>
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <span className="min-w-0">
        <span className={`block leading-tight font-extrabold ${wide ? 'text-xl' : 'text-[28px]'}`}>{value}</span>
        <span className="block leading-snug text-muted">{label}</span>
      </span>
    </Link>
  )
}

/** HOME-02: kartu ringkasan (angka saja, tanpa identitas — aman untuk semua peran) */
function Ringkasan({ stats }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-3" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-28 animate-pulse rounded-card bg-soft ${i > 1 ? 'col-span-2 h-20' : ''}`} />
        ))}
      </div>
    )
  }
  const ag = stats.agenda_terdekat
  return (
    <section aria-labelledby="ringkasan">
      <h2 id="ringkasan" className="mb-3 text-xl font-extrabold">
        Ringkasan
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard to="/pasien" icon={Users} value={formatAngka(stats.pasien_aktif)} label="Pasien aktif" />
        <StatCard
          to="/sahabat-kaki"
          icon={HandHeart}
          value={formatAngka(stats.kunjungan_minggu_ini)}
          label="Kunjungan minggu ini"
        />
        <div className="col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1">
          <StatCard
            to="/pos-kaki"
            icon={CalendarDays}
            wide
            value={ag ? `${formatTanggal(ag.event_date, { year: undefined, month: 'short' })}${ag.start_time ? ` · ${formatJam(ag.start_time)}` : ''}` : 'Belum ada jadwal'}
            label={ag ? `${ag.title} · ${ag.location}` : 'Pos Kaki terdekat'}
          />
          <StatCard to="/jimpitan" icon={Wallet} wide value={formatRupiah(stats.saldo_jimpitan)} label="Saldo Jimpitan Sehat" />
        </div>
      </div>
    </section>
  )
}

function Pintasan({ role }) {
  const items = PINTASAN[role] ?? PINTASAN.pasien
  return (
    <section aria-labelledby="pintasan">
      <h2 id="pintasan" className="mb-3 text-xl font-extrabold">
        Pintasan
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to + label}
            to={to}
            className="flex min-h-16 items-center gap-3 rounded-field border-2 border-line bg-surface px-4 py-3 font-bold transition-colors hover:border-primary hover:bg-soft/50"
          >
            <Icon aria-hidden="true" className="size-6 shrink-0 text-primary" />
            <span className="leading-snug">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default function Beranda() {
  const { profile, approved } = useAuth()
  const [stats, setStats] = useState(null)
  const [akunMenunggu, setAkunMenunggu] = useState(null)
  const role = profile.role

  useEffect(() => {
    supabase.rpc('dashboard_stats').then(({ data }) => setStats(data ?? {}))
  }, [])

  useEffect(() => {
    if (role !== 'admin' || !approved) return
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'menunggu')
      .then(({ count }) => setAkunMenunggu(count ?? 0))
  }, [role, approved])

  return (
    <div className="space-y-7">
      <Sambutan profile={profile} stats={stats} akunMenunggu={akunMenunggu} />
      {approved && ['perawat', 'kader', 'admin'].includes(role) && <PerluPerhatian role={role} />}
      <Ringkasan stats={stats} />
      <Pintasan role={role} />
      <ArtikelSection />
    </div>
  )
}
