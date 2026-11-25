import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Archive, ArchiveRestore, Database, FileDown, FileSpreadsheet, History, Plus, Save, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cek, useLoad } from '../../lib/useLoad'
import { muatNamaPasien, usePeran } from '../../lib/usePeran'
import { pesanError } from '../../lib/errors'
import { formatRupiah, formatTanggal, formatTanggalPendek, waktuRelatif } from '../../lib/format'
import { alamatSingkat, HAMBATAN, JENIS_KUNJUNGAN, PERUBAHAN, satuPenilaian, STATUS_KARTU, STATUS_PASIEN, TANDA, umur } from '../../lib/pasien'
import { unduhExcel, unduhPdf } from '../../lib/ekspor'
import { useToast } from '../../context/ToastContext'
import { useCan } from '../../components/Can'
import { Button } from '../../components/ui/Button'
import { TextInput } from '../../components/ui/Field'
import { Badge, Banner, Card, EmptyState, PageHeader, Spinner } from '../../components/ui/misc'
import { Saringan } from '../../components/ui/extra'

const KATEGORI_MASTER = {
  dusun: 'Dusun',
  rt: 'RT',
  pos_kaki: 'Tempat Pos Kaki',
  kondisi_kaki: 'Kategori kondisi kaki',
  kategori_pemasukan: 'Kategori pemasukan Jimpitan',
  kategori_pengeluaran: 'Kategori pengeluaran Jimpitan',
}
const NAMA_TABEL = {
  profiles: 'Akun', patients: 'Pasien', companions: 'Pendamping', companion_visits: 'Kunjungan pendamping',
  foot_visits: 'Kartu Kaki Sehat', assessments: 'Penilaian perawat', agenda: 'Agenda Pos Kaki', attendance: 'Kehadiran',
  drivers: 'Driver', rides: 'Ojek Sehat', funds: 'Jimpitan', community_resources: 'Sumber daya desa', activities: 'Kegiatan',
  activity_participants: 'Peserta kegiatan', kader_trainings: 'Pelatihan kader', coordination_meetings: 'Rapat Siaga Kaki',
  questionnaires: 'Kuesioner', articles: 'Artikel', master_options: 'Master data', app_settings: 'Pengaturan', evaluation_notes: 'Catatan evaluasi',
}
const AKSI = { INSERT: 'menambah', UPDATE: 'mengubah', DELETE: 'menghapus' }

// DATA-01: master data + pengaturan
function TabMaster({ bolehKelola }) {
  const toast = useToast()
  const [baru, setBaru] = useState({})
  const master = useLoad(() => supabase.from('master_options').select('*').order('category').order('sort_order').order('value').then(cek), [])
  const setelan = useLoad(() => supabase.from('app_settings').select('*').order('key').then(cek), [])
  const [nilai, setNilai] = useState({})

  async function tambah(kat) {
    const v = (baru[kat] ?? '').trim()
    if (!v) return
    const urut = (master.data ?? []).filter((m) => m.category === kat).length + 1
    const { error } = await supabase.from('master_options').insert({ category: kat, value: v, sort_order: urut })
    if (error) return toast.gagal(error.code === '23505' ? 'Nilai ini sudah ada.' : pesanError(error))
    setBaru((b) => ({ ...b, [kat]: '' }))
    master.reload()
  }
  async function ubahAktif(m) {
    const { error } = await supabase.from('master_options').update({ active: !m.active }).eq('id', m.id)
    if (error) return toast.gagal(pesanError(error))
    master.reload()
  }
  async function hapus(m) {
    const { error } = await supabase.from('master_options').delete().eq('id', m.id)
    if (error) return toast.gagal(pesanError(error))
    master.reload()
  }
  async function simpanSetelan(s) {
    const { error } = await supabase.from('app_settings').update({ value: (nilai[s.key] ?? s.value ?? '').trim() || null }).eq('key', s.key)
    if (error) return toast.gagal(pesanError(error))
    toast.sukses(`${s.label} disimpan.`)
    setelan.reload()
  }

  if (master.loading && !master.data) return <Spinner />
  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <h2 className="text-xl font-extrabold">Pengaturan aplikasi</h2>
        <p className="text-muted">Dipakai di kartu cetak (kontak Puskesmas) dan tombol grup WhatsApp di Pos Kaki.</p>
        {(setelan.data ?? []).map((s) =>
          bolehKelola ? (
            <div key={s.key} className="flex flex-wrap items-end gap-2">
              <TextInput label={s.label} value={nilai[s.key] ?? s.value ?? ''} onChange={(e) => setNilai((n) => ({ ...n, [s.key]: e.target.value }))} className="min-w-64 flex-1" />
              <Button variant="secondary" icon={Save} onClick={() => simpanSetelan(s)}>
                Simpan
              </Button>
            </div>
          ) : (
            <p key={s.key}>
              <strong>{s.label}:</strong> {s.value ?? '-'}
            </p>
          ),
        )}
      </Card>
      {Object.entries(KATEGORI_MASTER).map(([kat, label]) => {
        const rows = (master.data ?? []).filter((m) => m.category === kat)
        return (
          <Card key={kat}>
            <h2 className="text-xl font-extrabold">{label}</h2>
            {rows.length === 0 ? (
              <p className="mt-1 text-muted">Belum ada data.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {rows.map((m) => (
                  <li key={m.id} className={`inline-flex items-center gap-1 rounded-full border-2 py-1 pr-1 pl-3 font-semibold ${m.active ? 'border-line bg-surface' : 'border-dashed border-line bg-soft/40 text-muted line-through'}`}>
                    {m.value}
                    {bolehKelola && (
                      <>
                        <button type="button" onClick={() => ubahAktif(m)} className="min-h-9 rounded-full px-2 text-base font-bold text-primary hover:bg-soft">
                          {m.active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button type="button" aria-label={`Hapus ${m.value}`} onClick={() => hapus(m)} className="grid size-9 place-items-center rounded-full text-danger hover:bg-danger-soft">
                          <Trash2 aria-hidden="true" className="size-4" />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {bolehKelola && (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <TextInput label={`Tambah ${label.toLowerCase()}`} value={baru[kat] ?? ''} onChange={(e) => setBaru((b) => ({ ...b, [kat]: e.target.value }))} className="min-w-56 flex-1" />
                <Button variant="soft" icon={Plus} onClick={() => tambah(kat)}>
                  Tambah
                </Button>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

// DATA-02 (+ JIM-04): ekspor ke Excel/PDF — isinya mengikuti hak baca akun yang login
function TabEkspor({ peran }) {
  const toast = useToast()
  const [proses, setProses] = useState(null)
  const lengkap = peran.klinis || peran.sendiri

  async function jalan(kunci, fn) {
    setProses(kunci)
    try {
      await fn()
    } catch (err) {
      toast.gagal(pesanError(err))
    } finally {
      setProses(null)
    }
  }

  async function dataPasien() {
    if (lengkap) {
      const rows = await supabase.from('patients').select('*').order('full_name').then(cek)
      return {
        kolom: [
          { key: 'nama', label: 'Nama' }, { key: 'jk', label: 'JK' }, { key: 'umur', label: 'Umur' }, { key: 'alamat', label: 'Alamat' },
          { key: 'hp', label: 'No. HP' }, { key: 'keluarga', label: 'Keluarga pendamping' }, { key: 'dm', label: 'DM sejak' },
          { key: 'hambatan', label: 'Hambatan' }, { key: 'setuju', label: 'Persetujuan' }, { key: 'status', label: 'Status' },
        ],
        baris: rows.map((p) => ({
          nama: p.full_name, jk: p.gender, umur: umur(p.birth_date), alamat: alamatSingkat(p), hp: p.phone ?? '',
          keluarga: [p.family_name, p.family_relation && `(${p.family_relation})`].filter(Boolean).join(' '),
          dm: p.diabetes_since_year ?? '', hambatan: (p.barriers ?? []).map((b) => HAMBATAN[b]).join(', '),
          setuju: `Ikut program: ${p.consent_program ? 'Ya' : 'Tidak'}; berbagi kondisi: ${p.consent_share ? 'Ya' : 'Tidak'}`,
          status: p.archived_at ? 'Diarsipkan' : STATUS_PASIEN[p.status]?.label,
        })),
      }
    }
    const rows = await supabase.from('patient_directory').select('*').order('full_name').then(cek)
    return {
      kolom: [{ key: 'nama', label: 'Nama' }, { key: 'alamat', label: 'Alamat' }, { key: 'status', label: 'Status' }],
      baris: rows.map((p) => ({ nama: p.full_name, alamat: alamatSingkat(p), status: p.archived_at ? 'Diarsipkan' : STATUS_PASIEN[p.status]?.label })),
    }
  }

  async function dataKartu() {
    const nama = await muatNamaPasien(peran)
    if (lengkap) {
      const rows = await supabase.from('foot_visits').select('*, assessments(color_code, bwat_score, follow_up_instruction, assessed_at)').order('visit_date', { ascending: false }).then(cek)
      return {
        kolom: [
          { key: 'tgl', label: 'Tanggal' }, { key: 'pasien', label: 'Pasien' }, { key: 'pencatat', label: 'Pencatat' }, { key: 'perubahan', label: 'Perubahan' },
          { key: 'tanda', label: 'Tanda' }, { key: 'kode', label: 'Kode warna' }, { key: 'skor', label: 'Skor BWAT' }, { key: 'arahan', label: 'Arahan perawat' }, { key: 'status', label: 'Status' },
        ],
        baris: rows.map((k) => {
          const a = satuPenilaian(k.assessments)
          return {
            tgl: k.visit_date, pasien: nama[k.patient_id]?.full_name ?? '', pencatat: k.recorder_name ?? '', perubahan: PERUBAHAN[k.reported_change] ?? '',
            tanda: (k.signs ?? []).map((s) => TANDA[s]).join(', '), kode: a?.color_code?.toUpperCase() ?? 'Belum dinilai', skor: a?.bwat_score ?? '',
            arahan: a?.follow_up_instruction ?? '', status: STATUS_KARTU[k.status]?.label,
          }
        }),
      }
    }
    const rows = await supabase.from('foot_card_summary').select('*').order('visit_date', { ascending: false }).then(cek)
    return {
      kolom: [{ key: 'tgl', label: 'Tanggal' }, { key: 'pasien', label: 'Pasien' }, { key: 'kode', label: 'Kode warna' }, { key: 'skor', label: 'Skor BWAT' }, { key: 'status', label: 'Status' }],
      baris: rows.map((k) => ({ tgl: k.visit_date, pasien: nama[k.patient_id]?.full_name ?? '', kode: k.color_code?.toUpperCase() ?? 'Belum dinilai', skor: k.bwat_score ?? '', status: STATUS_KARTU[k.status]?.label })),
    }
  }

  async function dataKunjungan() {
    const nama = await muatNamaPasien(peran)
    const rows = lengkap
      ? await supabase.from('companion_visits').select('*').order('visit_date', { ascending: false }).then(cek)
      : await supabase.from('companion_visit_summary').select('*').order('visit_date', { ascending: false }).then(cek)
    return {
      kolom: [{ key: 'tgl', label: 'Tanggal' }, { key: 'pasien', label: 'Pasien' }, { key: 'jenis', label: 'Jenis' }, ...(lengkap ? [{ key: 'keluhan', label: 'Keluhan' }, { key: 'dukungan', label: 'Dukungan' }] : []), { key: 'lapor', label: 'Lapor perawat' }],
      baris: rows.map((v) => ({ tgl: v.visit_date, pasien: nama[v.patient_id]?.full_name ?? '', jenis: JENIS_KUNJUNGAN[v.activity_type], keluhan: v.complaints ?? '', dukungan: v.support_given ?? '', lapor: v.report_to_nurse ? 'Ya' : '' })),
    }
  }

  async function dataJimpitan() {
    const rows = await supabase.from('funds').select('*').order('trx_date').then(cek)
    let saldo = 0
    return {
      kolom: [{ key: 'tgl', label: 'Tanggal' }, { key: 'jenis', label: 'Jenis' }, { key: 'kategori', label: 'Kategori' }, { key: 'ket', label: 'Keterangan' }, { key: 'masuk', label: 'Masuk' }, { key: 'keluar', label: 'Keluar' }, { key: 'saldo', label: 'Saldo' }],
      baris: rows.map((f) => {
        saldo += f.trx_type === 'masuk' ? Number(f.amount) : -Number(f.amount)
        return { tgl: f.trx_date, jenis: f.trx_type === 'masuk' ? 'Pemasukan' : 'Pengeluaran', kategori: f.category, ket: f.description, masuk: f.trx_type === 'masuk' ? formatRupiah(f.amount) : '', keluar: f.trx_type === 'keluar' ? formatRupiah(f.amount) : '', saldo: formatRupiah(saldo) }
      }),
    }
  }

  const daftar = [
    { kunci: 'pasien', judul: 'Data pasien', ket: lengkap ? 'Identitas, alamat, hambatan, persetujuan, status.' : 'Data ringkas: nama, alamat, status.', fn: dataPasien, syarat: peran.staf || peran.sendiri },
    { kunci: 'kartu', judul: 'Rekap Kartu Kaki Sehat', ket: lengkap ? 'Pengamatan kader, kode warna, skor BWAT, arahan.' : 'Tanggal, kode warna, skor, status.', fn: dataKartu, syarat: peran.staf || peran.sendiri },
    { kunci: 'kunjungan', judul: 'Kunjungan Sahabat Kaki', ket: 'Tanggal dan jenis kunjungan pendamping.', fn: dataKunjungan, syarat: peran.staf || peran.sendiri },
    { kunci: 'jimpitan', judul: 'Laporan Jimpitan Sehat', ket: 'Semua transaksi dengan saldo berjalan.', fn: dataJimpitan, syarat: true },
  ]

  return (
    <div className="space-y-3">
      <Banner tone="info">Isi file mengikuti hak akses akun Anda. Simpan file dengan aman karena berisi data kesehatan.</Banner>
      {daftar
        .filter((d) => d.syarat)
        .map((d) => (
          <Card key={d.kunci} className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-lg font-extrabold">{d.judul}</p>
              <p className="text-muted">{d.ket}</p>
            </div>
            <Button size="sm" variant="secondary" icon={FileSpreadsheet} loading={proses === `${d.kunci}-x`} onClick={() => jalan(`${d.kunci}-x`, async () => { const t = await d.fn(); await unduhExcel(d.judul, [{ nama: d.judul, ...t }]) })}>
              Excel
            </Button>
            <Button size="sm" variant="secondary" icon={FileDown} loading={proses === `${d.kunci}-p`} onClick={() => jalan(`${d.kunci}-p`, async () => { const t = await d.fn(); await unduhPdf(d.judul, d.judul, [t], { mendatar: true }) })}>
              PDF
            </Button>
          </Card>
        ))}
    </div>
  )
}

// DATA-03: arsip pasien
function TabArsip({ peran }) {
  const toast = useToast()
  const bolehArsip = useCan('pasien.arsip')
  const { data, loading, reload } = useLoad(
    () => (peran.klinis ? supabase.from('patients').select('id, full_name, dusun, rt, archived_at').not('archived_at', 'is', null).order('archived_at', { ascending: false }).then(cek) : peran.desa ? supabase.from('patient_directory').select('*').not('archived_at', 'is', null).then(cek) : []),
    [],
  )
  async function pulihkan(p) {
    const { error } = await supabase.from('patients').update({ archived_at: null }).eq('id', p.id)
    if (error) return toast.gagal(pesanError(error))
    toast.sukses(`${p.full_name} dipulihkan.`)
    reload()
  }
  if (loading && !data) return <Spinner />
  return (
    <div className="space-y-3">
      <p className="text-muted">Pasien yang selesai diarsipkan, tidak dihapus permanen. Riwayatnya tetap tersimpan.</p>
      {(data ?? []).length === 0 ? (
        <EmptyState icon={Archive} title="Belum ada pasien di arsip" />
      ) : (
        <ul className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
          {data.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 last:border-0">
              <span className="min-w-0 flex-1">
                <Link to={`/pasien/${p.id}`} className="font-extrabold underline-offset-4 hover:underline">
                  {p.full_name}
                </Link>
                <span className="block text-muted">
                  {alamatSingkat(p)} · diarsipkan {formatTanggalPendek(p.archived_at)}
                </span>
              </span>
              {bolehArsip && (
                <Button size="sm" variant="secondary" icon={ArchiveRestore} onClick={() => pulihkan(p)}>
                  Pulihkan
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// DATA-04: log aktivitas
function TabLog() {
  const [tabel, setTabel] = useState('')
  const { data, loading } = useLoad(async () => {
    const [log, orang] = await Promise.all([
      supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(300).then(cek),
      supabase.from('profiles').select('id, full_name').then(cek),
    ])
    return { log, nama: Object.fromEntries(orang.map((o) => [o.id, o.full_name])) }
  }, [])
  const daftar = useMemo(() => (data?.log ?? []).filter((l) => !tabel || l.table_name === tabel), [data, tabel])
  if (loading && !data) return <Spinner />
  const ada = [...new Set((data?.log ?? []).map((l) => l.table_name))]
  return (
    <div className="space-y-3">
      <p className="text-muted">Siapa mengubah data apa dan kapan (300 aktivitas terakhir). Isi datanya tidak ditampilkan di sini.</p>
      <label className="block max-w-sm">
        <span className="font-bold">Saring jenis data</span>
        <select value={tabel} onChange={(e) => setTabel(e.target.value)} className="mt-2 min-h-13 w-full rounded-field border-2 border-line bg-surface px-4">
          <option value="">Semua</option>
          {ada.map((t) => (
            <option key={t} value={t}>
              {NAMA_TABEL[t] ?? t}
            </option>
          ))}
        </select>
      </label>
      {daftar.length === 0 ? (
        <EmptyState icon={History} title="Belum ada aktivitas" />
      ) : (
        <ul className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
          {daftar.map((l) => (
            <li key={l.id} className="border-b border-line px-4 py-2 last:border-0">
              <p>
                <strong>{data.nama[l.actor_id] ?? 'Sistem'}</strong> {AKSI[l.action]} <Badge tone="neutral">{NAMA_TABEL[l.table_name] ?? l.table_name}</Badge>
              </p>
              <p className="text-base text-muted" title={formatTanggal(l.created_at, { hour: '2-digit', minute: '2-digit' })}>
                {waktuRelatif(l.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function KelolaData() {
  const peran = usePeran()
  const bolehKelola = useCan('data.kelola')
  const [tab, setTab] = useState('master')
  return (
    <div className="space-y-5">
      <PageHeader title="Kelola Data" description="Master data, pengaturan, ekspor laporan, arsip pasien, dan log aktivitas." menu="kelola-data" />
      {!peran.approved ? (
        <EmptyState icon={Database} title="Kelola Data tampil setelah akun disetujui" />
      ) : (
        <>
          <Saringan
            label="Bagian"
            value={tab}
            onChange={setTab}
            options={[
              { key: 'master', label: 'Master data' },
              { key: 'ekspor', label: 'Ekspor' },
              ...(peran.klinis || peran.desa ? [{ key: 'arsip', label: 'Arsip pasien' }] : []),
              { key: 'log', label: 'Log aktivitas' },
            ]}
          />
          {tab === 'master' && <TabMaster bolehKelola={bolehKelola} />}
          {tab === 'ekspor' && <TabEkspor peran={peran} />}
          {tab === 'arsip' && <TabArsip peran={peran} />}
          {tab === 'log' && <TabLog />}
        </>
      )}
    </div>
  )
}
