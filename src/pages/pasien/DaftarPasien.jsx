import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router'
import { ChevronRight, Plus, UserRound, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cek, useLoad } from '../../lib/useLoad'
import { alamatSingkat, umur } from '../../lib/pasien'
import { useAuth } from '../../context/AuthContext'
import { Can, useCan } from '../../components/Can'
import { ButtonLink } from '../../components/ui/Button'
import { Banner, CodeBadge, EmptyState, PageHeader, Spinner } from '../../components/ui/misc'
import { KotakCari, Saringan, StatusPasienBadge } from '../../components/ui/extra'

// PAS-01: daftar pasien dengan pencarian (nama, NIK, dusun/RT) dan saringan status
export default function DaftarPasien() {
  const { profile, approved } = useAuth()
  const role = profile.role
  const klinis = approved && ['perawat', 'kader', 'admin'].includes(role)
  const desa = approved && role === 'desa'
  const bolehArsip = useCan('pasien.arsip')
  const [cari, setCari] = useState('')
  const [filter, setFilter] = useState(role === 'kader' ? 'dampingan' : 'aktif')

  const { data, loading, error } = useLoad(async () => {
    if (!klinis && !desa) return { pasien: [], kartu: {}, pendamping: {} }
    const [pasien, kartu, pendamping] = await Promise.all([
      klinis
        ? supabase
            .from('patients')
            .select('id, full_name, nik, birth_date, gender, dusun, rt, rw, status, archived_at')
            .order('full_name')
            .then(cek)
        : supabase.from('patient_directory').select('*').order('full_name').then(cek),
      supabase
        .from('foot_card_summary')
        .select('patient_id, color_code, visit_date, status')
        .order('visit_date', { ascending: false })
        .limit(2000)
        .then(cek),
      supabase.from('companions').select('patient_id, name, profile_id').eq('active', true).then(cek),
    ])
    // Kartu terakhir & pendamping aktif per pasien
    const kartuTerakhir = {}
    for (const k of kartu) if (!kartuTerakhir[k.patient_id]) kartuTerakhir[k.patient_id] = k
    const petaPendamping = Object.fromEntries(pendamping.map((c) => [c.patient_id, c]))
    return { pasien, kartu: kartuTerakhir, pendamping: petaPendamping }
  }, [klinis, desa])

  const daftar = useMemo(() => {
    if (!data) return []
    const q = cari.trim().toLowerCase()
    return data.pasien.filter((p) => {
      const arsip = Boolean(p.archived_at)
      if (filter === 'arsip') {
        if (!arsip) return false
      } else if (arsip) return false
      if (filter === 'aktif' && p.status !== 'aktif') return false
      if (filter === 'rujukan' && p.status !== 'rujukan') return false
      if (filter === 'selesai' && p.status !== 'selesai') return false
      if (filter === 'dampingan' && data.pendamping[p.id]?.profile_id !== profile.id) return false
      if (!q) return true
      return [p.full_name, p.nik, p.dusun, p.rt && `rt ${p.rt}`, p.rt].some((s) =>
        String(s ?? '').toLowerCase().includes(q),
      )
    })
  }, [data, cari, filter, profile.id])

  // Pasien/Keluarga langsung ke data pasiennya sendiri
  if (role === 'pasien') {
    if (profile.patient_id) return <Navigate to={`/pasien/${profile.patient_id}`} replace />
    return (
      <div>
        <PageHeader title="Pasien" />
        <EmptyState icon={UserRound} title="Akun belum terhubung ke data pasien">
          Minta Perawat atau Kader untuk menghubungkan akun ini ke data pasien.
        </EmptyState>
      </div>
    )
  }

  const opsi = [
    ...(role === 'kader' ? [{ key: 'dampingan', label: 'Dampingan saya' }] : []),
    { key: 'aktif', label: 'Aktif' },
    { key: 'rujukan', label: 'Rujukan' },
    { key: 'selesai', label: 'Selesai' },
    { key: 'semua', label: 'Semua' },
    ...(bolehArsip ? [{ key: 'arsip', label: 'Arsip' }] : []),
  ]

  return (
    <div>
      <PageHeader
        title="Pasien"
        description="Satu riwayat untuk setiap pasien, bisa dilanjutkan dari perangkat mana pun."
        menu="pasien"
        actions={
          <Can do="pasien.tambah">
            <ButtonLink to="/pasien/baru" icon={Plus}>
              Tambah pasien
            </ButtonLink>
          </Can>
        }
      />

      {!approved && (
        <EmptyState icon={Users} title="Data pasien belum bisa ditampilkan">
          Data pasien tampil setelah akun Anda disetujui Admin.
        </EmptyState>
      )}

      {approved && (
        <>
          {desa && (
            <Banner tone="info" className="mb-4">
              Perangkat Desa melihat data ringkas (nama, alamat, status) tanpa catatan klinis.
            </Banner>
          )}
          <div className="mb-4 space-y-3">
            <KotakCari value={cari} onChange={setCari} placeholder="Cari nama, NIK, dusun, atau RT" />
            <Saringan label="Saring status pasien" options={opsi} value={filter} onChange={setFilter} />
          </div>

          {loading ? (
            <Spinner />
          ) : error ? (
            <Banner tone="danger">{error}</Banner>
          ) : daftar.length === 0 ? (
            <EmptyState icon={Users} title={cari ? 'Pasien tidak ditemukan' : 'Belum ada pasien'}>
              {cari ? 'Coba kata pencarian lain.' : filter === 'dampingan' ? 'Belum ada pasien yang dipasangkan dengan Anda.' : 'Pasien yang didaftarkan akan muncul di sini.'}
            </EmptyState>
          ) : (
            <>
              <p className="mb-2 text-muted">{daftar.length} pasien</p>
              <ul className="space-y-3">
                {daftar.map((p) => {
                  const kartu = data.kartu[p.id]
                  const pend = data.pendamping[p.id]
                  const u = umur(p.birth_date)
                  return (
                    <li key={p.id}>
                      <Link
                        to={`/pasien/${p.id}`}
                        className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card transition-colors hover:border-primary/40"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-lg leading-snug font-extrabold">{p.full_name}</span>
                          <span className="block text-muted">
                            {p.gender === 'P' ? 'Perempuan' : 'Laki-laki'}
                            {u !== null && `, ${u} th`} · {alamatSingkat(p)}
                          </span>
                          <span className="block text-muted">
                            Pendamping: {pend ? pend.name : <span className="font-semibold text-warning">belum ada</span>}
                          </span>
                          <span className="mt-2 flex flex-wrap gap-2">
                            <StatusPasienBadge status={p.status} archived={p.archived_at} />
                            {kartu && <CodeBadge code={kartu.color_code} />}
                          </span>
                        </span>
                        <ChevronRight aria-hidden="true" className="size-6 shrink-0 text-muted" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}
