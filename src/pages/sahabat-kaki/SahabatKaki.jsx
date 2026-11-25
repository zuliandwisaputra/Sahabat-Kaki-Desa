import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CalendarClock, HandHeart, Siren, UserCheck, UserRound } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cek, useLoad } from '../../lib/useLoad'
import { formatTanggalPendek } from '../../lib/format'
import { awalMingguIni, JENIS_KUNJUNGAN, selisihHari } from '../../lib/pasien'
import { useAuth } from '../../context/AuthContext'
import { useCan } from '../../components/Can'
import { Button } from '../../components/ui/Button'
import { Badge, Banner, Card, EmptyState, PageHeader, Spinner } from '../../components/ui/misc'
import { Saringan, TombolKontak } from '../../components/ui/extra'
import { KunjunganForm, PasangkanForm } from './forms'

const BATAS_HARI = 7 // SK-03: kunjungan terlambat jika lebih dari 7 hari

function Statistik({ icon: Icon, nilai, label, tone = 'primary' }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <span className={`mb-2 grid size-11 place-items-center rounded-2xl ${tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-soft text-primary'}`}>
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <span className="block text-[26px] leading-tight font-extrabold">{nilai}</span>
      <span className="block leading-snug text-muted">{label}</span>
    </div>
  )
}

export default function SahabatKaki() {
  const { profile, approved } = useAuth()
  const role = profile.role
  const klinis = approved && ['perawat', 'kader', 'admin'].includes(role)
  const desa = approved && role === 'desa'
  const sendiri = approved && role === 'pasien' && Boolean(profile.patient_id)
  const bolehPasangkan = useCan('sahabat.pasangkan')
  const [filter, setFilter] = useState(role === 'kader' ? 'dampingan' : 'semua')
  const [modal, setModal] = useState(null) // { jenis, pasien, aktif }

  const { data, loading, error, reload } = useLoad(async () => {
    if (!klinis && !desa && !sendiri) return null
    const lengkap = klinis || sendiri
    const [pasien, pendamping, kunjungan] = await Promise.all([
      klinis || sendiri
        ? supabase.from('patients').select('id, full_name, rt, dusun, status, archived_at, consent_share').order('full_name').then(cek)
        : supabase.from('patient_directory').select('*').order('full_name').then(cek),
      supabase.from('companions').select('*').eq('active', true).then(cek),
      lengkap
        ? supabase
            .from('companion_visits')
            .select('id, patient_id, companion_id, visit_date, activity_type, complaints, report_to_nurse, created_at')
            .order('visit_date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(500)
            .then(cek)
        : supabase.from('companion_visit_summary').select('*').order('visit_date', { ascending: false }).limit(500).then(cek),
    ])
    return { pasien, pendamping, kunjungan }
  }, [klinis, desa, sendiri])

  const olah = useMemo(() => {
    if (!data) return null
    const minggu = awalMingguIni()
    const pend = Object.fromEntries(data.pendamping.map((c) => [c.patient_id, c]))
    const terakhir = {}
    for (const k of data.kunjungan) if (!terakhir[k.patient_id]) terakhir[k.patient_id] = k
    const namaPasien = Object.fromEntries(data.pasien.map((p) => [p.id, p.full_name]))
    const aktif = data.pasien.filter((p) => !p.archived_at && p.status !== 'selesai')
    const baris = aktif.map((p) => {
      const c = pend[p.id] ?? null
      const t = terakhir[p.id] ?? null
      const acuan = t?.visit_date ?? c?.paired_at ?? null
      const hari = acuan ? selisihHari(acuan) : null
      return { p, c, t, hari, terlambat: Boolean(c) && hari !== null && hari > BATAS_HARI }
    })
    return {
      baris,
      namaPasien,
      cakupan: baris.filter((b) => b.c).length,
      total: baris.length,
      mingguIni: data.kunjungan.filter((k) => k.visit_date >= minggu).length,
      terlambat: baris.filter((b) => b.terlambat).length,
      laporan: data.kunjungan.filter((k) => k.visit_date >= minggu && k.report_to_nurse).length,
    }
  }, [data])

  const daftar = useMemo(() => {
    if (!olah) return []
    return olah.baris
      .filter((b) => {
        if (filter === 'dampingan') return b.c?.profile_id === profile.id
        if (filter === 'terlambat') return b.terlambat
        if (filter === 'tanpa') return !b.c
        return true
      })
      .sort((a, b) => Number(b.terlambat) - Number(a.terlambat) || (b.hari ?? 999) - (a.hari ?? 999))
  }, [olah, filter, profile.id])

  const bolehCatat = (b) =>
    approved && b.c && !b.p.archived_at && (['perawat', 'admin'].includes(role) || (role === 'kader' && b.c.profile_id === profile.id))

  // ---------------- Tampilan Pasien/Keluarga
  if (role === 'pasien') {
    const b = olah?.baris[0]
    return (
      <div className="space-y-5">
        <PageHeader title="Sahabat Kaki" description="Pendamping yang mengunjungi pasien setiap minggu." menu="sahabat-kaki" />
        {!sendiri ? (
          <EmptyState icon={UserRound} title="Akun belum terhubung ke data pasien">
            Minta Perawat atau Kader untuk menghubungkan akun ini ke data pasien.
          </EmptyState>
        ) : loading ? (
          <Spinner />
        ) : error ? (
          <Banner tone="danger">{error}</Banner>
        ) : (
          <>
            <Card>
              <h2 className="text-xl font-extrabold">Pendamping</h2>
              {b?.c ? (
                <div className="mt-2 space-y-2">
                  <p className="text-lg font-extrabold">{b.c.name}</p>
                  <p className="text-muted">Mendampingi sejak {formatTanggalPendek(b.c.paired_at)}</p>
                  <TombolKontak phone={b.c.phone} nama={b.c.name} pesan="Halo, saya keluarga pasien dampingan Sahabat Kaki." />
                </div>
              ) : (
                <p className="mt-2 text-muted">Belum ada pendamping. Perawat akan memasangkan pendamping dari RT Anda.</p>
              )}
            </Card>
            <DaftarKunjungan kunjungan={data.kunjungan} namaPasien={olah.namaPasien} tampilNama={false} />
          </>
        )}
      </div>
    )
  }

  // ---------------- Tampilan petugas
  const opsi = [
    ...(role === 'kader' ? [{ key: 'dampingan', label: 'Dampingan saya' }] : []),
    { key: 'semua', label: 'Semua pasien' },
    { key: 'terlambat', label: 'Terlambat', count: olah?.terlambat },
    { key: 'tanpa', label: 'Belum ada pendamping', count: olah ? olah.total - olah.cakupan : undefined },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sahabat Kaki"
        description="Pendampingan mingguan oleh kader atau anggota PKK dari RT yang sama."
        menu="sahabat-kaki"
      />
      {!approved ? (
        <EmptyState icon={HandHeart} title="Data pendampingan belum bisa ditampilkan">
          Data tampil setelah akun Anda disetujui Admin.
        </EmptyState>
      ) : loading && !data ? (
        <Spinner />
      ) : error ? (
        <Banner tone="danger">{error}</Banner>
      ) : (
        <>
          <section aria-label="Rekap pendampingan" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Statistik icon={UserCheck} nilai={`${olah.cakupan}/${olah.total}`} label="Pasien punya pendamping" />
            <Statistik icon={HandHeart} nilai={olah.mingguIni} label="Kunjungan minggu ini" />
            <Statistik icon={CalendarClock} nilai={olah.terlambat} label={`Terlambat (> ${BATAS_HARI} hari)`} tone={olah.terlambat ? 'danger' : 'primary'} />
            <Statistik icon={Siren} nilai={olah.laporan} label="Laporan ke perawat minggu ini" />
          </section>

          <Saringan label="Saring pasien" options={opsi} value={filter} onChange={setFilter} />

          {daftar.length === 0 ? (
            <EmptyState icon={HandHeart} title="Tidak ada pasien di daftar ini">
              {filter === 'dampingan' ? 'Belum ada pasien yang dipasangkan dengan Anda.' : 'Coba saringan lain.'}
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {daftar.map((b) => (
                <li key={b.p.id} className={`rounded-card border bg-surface p-4 shadow-card ${b.terlambat ? 'border-2 border-merah-line' : 'border-line'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/pasien/${b.p.id}`} className="text-lg font-extrabold underline-offset-4 hover:underline">
                        {b.p.full_name}
                      </Link>
                      <p className="text-muted">
                        RT {b.p.rt} · Pendamping:{' '}
                        {b.c ? b.c.name : <span className="font-bold text-warning">belum ada</span>}
                      </p>
                      <p className="text-muted">
                        {b.t
                          ? `Kunjungan terakhir ${formatTanggalPendek(b.t.visit_date)} (${b.hari === 0 ? 'hari ini' : `${b.hari} hari lalu`}) · ${JENIS_KUNJUNGAN[b.t.activity_type]}`
                          : b.c
                            ? `Belum ada kunjungan sejak dipasangkan ${formatTanggalPendek(b.c.paired_at)}`
                            : 'Belum ada kunjungan'}
                      </p>
                    </div>
                    {b.terlambat && <Badge tone="danger">Terlambat</Badge>}
                  </div>
                  {(bolehCatat(b) || bolehPasangkan) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {bolehCatat(b) && (
                        <Button size="sm" icon={HandHeart} onClick={() => setModal({ jenis: 'kunjungan', pasien: b.p, aktif: b.c })}>
                          Catat kunjungan
                        </Button>
                      )}
                      {bolehPasangkan && (
                        <Button size="sm" variant="secondary" onClick={() => setModal({ jenis: 'pasangkan', pasien: b.p, aktif: b.c })}>
                          {b.c ? 'Ganti pendamping' : 'Pasangkan pendamping'}
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <DaftarKunjungan kunjungan={data.kunjungan.slice(0, 15)} namaPasien={olah.namaPasien} tampilNama ringkas={desa} />
        </>
      )}

      <KunjunganForm
        open={modal?.jenis === 'kunjungan'}
        onClose={() => setModal(null)}
        pasien={modal?.pasien}
        companionId={modal?.aktif?.id}
        onSaved={reload}
      />
      <PasangkanForm
        open={modal?.jenis === 'pasangkan'}
        onClose={() => setModal(null)}
        pasien={modal?.pasien}
        aktif={modal?.aktif}
        onSaved={reload}
      />
    </div>
  )
}

function DaftarKunjungan({ kunjungan, namaPasien, tampilNama, ringkas }) {
  return (
    <section aria-labelledby="kunjungan-terbaru">
      <h2 id="kunjungan-terbaru" className="mb-3 text-xl font-extrabold">
        Kunjungan terbaru
      </h2>
      {kunjungan.length === 0 ? (
        <EmptyState icon={HandHeart} title="Belum ada kunjungan tercatat" />
      ) : (
        <ul className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
          {kunjungan.map((k) => (
            <li key={k.id} className="border-b border-line px-4 py-3 last:border-0">
              <p className="text-base text-muted">{formatTanggalPendek(k.visit_date)}</p>
              <p className="font-extrabold">
                {tampilNama && `${namaPasien[k.patient_id] ?? 'Pasien'} · `}
                {JENIS_KUNJUNGAN[k.activity_type]}
              </p>
              {!ringkas && k.complaints && <p>Keluhan: {k.complaints}</p>}
              {k.report_to_nurse && (
                <Badge tone="danger" className="mt-1">
                  Dilaporkan ke perawat
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
