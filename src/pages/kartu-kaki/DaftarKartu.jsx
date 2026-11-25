import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight, ClipboardList, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cek, useLoad } from '../../lib/useLoad'
import { formatTanggalPendek } from '../../lib/format'
import { petaId, satuPenilaian } from '../../lib/pasien'
import { useAuth } from '../../context/AuthContext'
import { Can } from '../../components/Can'
import { ButtonLink } from '../../components/ui/Button'
import { Banner, CodeBadge, EmptyState, PageHeader, Spinner } from '../../components/ui/misc'
import { Saringan, StatusKartuBadge } from '../../components/ui/extra'

export default function DaftarKartu() {
  const { profile, approved } = useAuth()
  const role = profile.role
  const klinis = approved && ['perawat', 'kader', 'admin'].includes(role)
  const desa = approved && role === 'desa'
  const sendiri = approved && role === 'pasien' && Boolean(profile.patient_id)
  const [filter, setFilter] = useState(['perawat', 'admin'].includes(role) ? 'menunggu' : 'semua')

  const { data, loading, error } = useLoad(async () => {
    if (!klinis && !desa && !sendiri) return null
    if (desa) {
      const [kartu, pasien] = await Promise.all([
        supabase.from('foot_card_summary').select('*').order('visit_date', { ascending: false }).limit(300).then(cek),
        supabase.from('patient_directory').select('id, full_name, rt').then(cek),
      ])
      return { kartu: kartu.map((k) => ({ ...k, kode: k.color_code })), pasien: petaId(pasien) }
    }
    const [kartu, pasien] = await Promise.all([
      supabase
        .from('foot_visits')
        .select('id, patient_id, visit_date, status, recorder_name, recorded_by, created_at, assessments(color_code)')
        .order('visit_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(300)
        .then(cek),
      supabase.from('patients').select('id, full_name, rt').then(cek),
    ])
    return {
      kartu: kartu.map((k) => ({ ...k, kode: satuPenilaian(k.assessments)?.color_code ?? null })),
      pasien: petaId(pasien),
    }
  }, [klinis, desa, sendiri])

  const hitung = useMemo(() => {
    const k = data?.kartu ?? []
    return {
      menunggu: k.filter((x) => x.status === 'dikirim').length,
      tindaklanjut: k.filter((x) => x.status === 'dinilai' && ['kuning', 'merah'].includes(x.kode)).length,
      draft: k.filter((x) => x.status === 'draft' && x.recorded_by === profile.id).length,
    }
  }, [data, profile.id])

  const daftar = useMemo(() => {
    const k = data?.kartu ?? []
    if (filter === 'menunggu') return k.filter((x) => x.status === 'dikirim')
    if (filter === 'tindaklanjut') return k.filter((x) => x.status === 'dinilai' && ['kuning', 'merah'].includes(x.kode))
    if (filter === 'draft') return k.filter((x) => x.status === 'draft' && x.recorded_by === profile.id)
    return k
  }, [data, filter, profile.id])

  const opsi =
    role === 'pasien'
      ? null
      : [
          { key: 'menunggu', label: 'Menunggu penilaian', count: hitung.menunggu },
          { key: 'tindaklanjut', label: 'Perlu tindak lanjut', count: hitung.tindaklanjut },
          ...(klinis ? [{ key: 'draft', label: 'Draft saya', count: hitung.draft }] : []),
          { key: 'semua', label: 'Semua' },
        ]

  return (
    <div>
      <PageHeader
        title="Kartu Kaki Sehat"
        description="Kader mencatat pengamatan, perawat memberi kode warna dan arahan."
        menu="kartu-kaki"
        actions={
          <Can do="kartu.catat">
            <ButtonLink to="/kartu-kaki/baru" icon={Plus}>
              Isi Kartu Kaki
            </ButtonLink>
          </Can>
        }
      />
      {!klinis && !desa && !sendiri ? (
        <EmptyState icon={ClipboardList} title="Kartu belum bisa ditampilkan">
          {role === 'pasien'
            ? 'Akun Anda belum terhubung ke data pasien. Minta Perawat atau Kader untuk menghubungkannya.'
            : 'Data tampil setelah akun Anda disetujui Admin.'}
        </EmptyState>
      ) : loading ? (
        <Spinner />
      ) : error ? (
        <Banner tone="danger">{error}</Banner>
      ) : (
        <>
          {desa && (
            <Banner tone="info" className="mb-4">
              Perangkat Desa melihat tanggal, status, dan kode warna saja, tanpa catatan klinis, foto luka, dan SBAR.
            </Banner>
          )}
          {opsi && (
            <div className="mb-4">
              <Saringan label="Saring kartu" options={opsi} value={filter} onChange={setFilter} />
            </div>
          )}
          {daftar.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Tidak ada kartu di daftar ini">
              {filter === 'menunggu' ? 'Semua kartu yang dikirim kader sudah dinilai.' : 'Kartu yang diisi akan muncul di sini.'}
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {daftar.map((k) => {
                const p = data.pasien[k.patient_id]
                const isi = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg leading-snug font-extrabold">{p?.full_name ?? 'Pasien'}</span>
                      <span className="block text-muted">
                        {formatTanggalPendek(k.visit_date)}
                        {p?.rt && ` · RT ${p.rt}`}
                        {k.recorder_name && ` · dicatat ${k.recorder_name}`}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-2">
                        <CodeBadge code={k.kode} />
                        <StatusKartuBadge status={k.status} />
                      </span>
                    </span>
                    <ChevronRight aria-hidden="true" className="size-6 shrink-0 text-muted" />
                  </>
                )
                return (
                  <li key={k.id}>
                    <Link
                      to={`/kartu-kaki/${k.id}`}
                      className={`flex items-center gap-3 rounded-card border bg-surface p-4 shadow-card hover:border-primary/40 ${
                        k.kode === 'merah' && k.status === 'dinilai' ? 'border-2 border-merah-line' : 'border-line'
                      }`}
                    >
                      {isi}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
