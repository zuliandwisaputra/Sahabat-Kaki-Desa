import { useMemo, useState } from 'react'
import { CalendarDays, ExternalLink, GraduationCap, Landmark, Pencil, Plus, Sprout, Trash2, UserPlus, Users, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cek, useLoad } from '../../lib/useLoad'
import { muatNamaPasien, usePeran } from '../../lib/usePeran'
import { pesanError } from '../../lib/errors'
import { formatJam, formatTanggal, formatTanggalPendek, hariIniWIB } from '../../lib/format'
import { satuPenilaian } from '../../lib/pasien'
import { useToast } from '../../context/ToastContext'
import { useCan } from '../../components/Can'
import { Button } from '../../components/ui/Button'
import { Select, TextInput } from '../../components/ui/Field'
import { FormModal } from '../../components/ui/FormModal'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Badge, Banner, Card, EmptyState, PageHeader, Spinner } from '../../components/ui/misc'
import { Saringan, TombolKontak } from '../../components/ui/extra'
import { ArtikelSection } from '../beranda/ArtikelSection'

const JENIS_KEGIATAN = {
  senam_lansia: 'Senam lansia',
  kunjungan_pkk: 'Kunjungan rumah PKK',
  kelompok_dukungan: 'Kelompok dukungan',
  edukasi_anti_stigma: 'Edukasi anti-stigma',
  lainnya: 'Lainnya',
}
const JENIS_SUMBER = {
  posbindu_ptm: 'Posbindu PTM',
  posyandu_ilp: 'Posyandu ILP',
  kader: 'Kader',
  pkk: 'PKK',
  senam_lansia: 'Komunitas senam lansia',
  puskesmas: 'Puskesmas',
  ojek_sehat: 'Ojek Sehat',
  sumber_dana: 'Sumber dana (JKN, APBDes)',
  kelompok_dukungan: 'Kelompok dukungan',
  duta_kaki_sehat: 'Duta Kaki Sehat',
  kebijakan: 'Dokumen kebijakan lokal',
  lainnya: 'Lainnya',
}
const MATERI = {
  tanda_bahaya_luka: 'Tanda bahaya luka',
  pengisian_kks: 'Pengisian Kartu Kaki Sehat',
  mekanisme_pelaporan: 'Mekanisme pelaporan',
  lainnya: 'Lainnya',
}
const opsi = (obj) => Object.entries(obj).map(([value, label]) => ({ value, label }))
const teks = (v) => (typeof v === 'string' ? v.trim() || null : (v ?? null))

/** Tombol ubah + hapus seragam */
function AksiKelola({ onUbah, onHapus }) {
  return (
    <div className="mt-2 flex justify-end gap-1">
      <Button size="sm" variant="quiet" icon={Pencil} onClick={onUbah}>
        Ubah
      </Button>
      <Button size="sm" variant="quiet" icon={Trash2} className="text-danger" onClick={onHapus}>
        Hapus
      </Button>
    </div>
  )
}

/** Hook kecil untuk dialog hapus */
function useHapus(tabel, onDone) {
  const toast = useToast()
  const [target, setTarget] = useState(null)
  const [proses, setProses] = useState(false)
  const dialog = (
    <ConfirmDialog
      open={Boolean(target)}
      onClose={() => setTarget(null)}
      loading={proses}
      danger
      title="Hapus data ini?"
      message={target ? `"${target.label}" akan dihapus.` : ''}
      confirmLabel="Ya, hapus"
      onConfirm={async () => {
        setProses(true)
        const { error } = await supabase.from(tabel).delete().eq('id', target.id)
        setProses(false)
        if (error) return toast.gagal(pesanError(error))
        toast.sukses('Data dihapus.')
        setTarget(null)
        onDone()
      }}
    />
  )
  return [setTarget, dialog]
}

// ============================================================================
// Kegiatan pemberdayaan (PEM-02) + rekomendasi aktivitas (PEM-03)
// ============================================================================
function PesertaModal({ open, onClose, kegiatan, peserta, pasien, onChanged }) {
  const toast = useToast()
  const [pilih, setPilih] = useState('')
  const [warga, setWarga] = useState('')
  if (!kegiatan) return null
  const daftar = peserta.filter((p) => p.activity_id === kegiatan.id)
  const sudah = new Set(daftar.map((p) => p.patient_id))
  const jalankan = async (q, pesan) => {
    const { error } = await q
    if (error) return toast.gagal(pesanError(error))
    if (pesan) toast.sukses(pesan)
    onChanged()
  }
  return (
    <Modal open={open} onClose={onClose} title={`Peserta: ${kegiatan.title}`} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end gap-2">
          <Select label="Tambah pasien" value={pilih} onChange={(e) => setPilih(e.target.value)} className="min-w-56 flex-1">
            <option value="">— pilih —</option>
            {Object.values(pasien)
              .filter((p) => !p.archived_at && !sudah.has(p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} · RT {p.rt}
                </option>
              ))}
          </Select>
          <Button
            icon={UserPlus}
            disabled={!pilih}
            onClick={() => {
              jalankan(supabase.from('activity_participants').insert({ activity_id: kegiatan.id, patient_id: pilih }), 'Peserta ditambahkan.')
              setPilih('')
            }}
          >
            Tambah
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <TextInput label="Tambah warga (bukan pasien)" value={warga} onChange={(e) => setWarga(e.target.value)} className="min-w-56 flex-1" />
          <Button
            variant="secondary"
            icon={UserPlus}
            disabled={warga.trim().length < 2}
            onClick={() => {
              jalankan(supabase.from('activity_participants').insert({ activity_id: kegiatan.id, participant_name: warga.trim() }), 'Peserta ditambahkan.')
              setWarga('')
            }}
          >
            Tambah
          </Button>
        </div>
        {daftar.length === 0 ? (
          <p className="text-muted">Belum ada peserta.</p>
        ) : (
          <ul className="divide-y divide-line rounded-field border border-line">
            {daftar.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                <span className="min-w-0 flex-1 font-bold">
                  {p.patient_id ? (pasien[p.patient_id]?.full_name ?? 'Pasien') : p.participant_name}
                  {p.patient_id && <span className="font-normal text-muted"> · pasien</span>}
                </span>
                <div className="flex gap-1" role="group" aria-label="Kehadiran">
                  {[
                    [true, 'Hadir'],
                    [false, 'Tidak'],
                  ].map(([v, l]) => (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={p.attended === v}
                      onClick={() => jalankan(supabase.from('activity_participants').update({ attended: v }).eq('id', p.id))}
                      className={`min-h-11 rounded-full border-2 px-3 font-bold ${p.attended === v ? (v ? 'border-primary bg-primary text-white' : 'border-danger bg-danger text-white') : 'border-line bg-surface hover:bg-soft'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  aria-label="Hapus peserta"
                  onClick={() => jalankan(supabase.from('activity_participants').delete().eq('id', p.id), 'Peserta dihapus.')}
                  className="grid size-11 place-items-center rounded-full text-danger hover:bg-danger-soft"
                >
                  <X aria-hidden="true" className="size-5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}

function TabKegiatan({ peran, bolehKelola }) {
  const toast = useToast()
  const [form, setForm] = useState({ open: false, awal: null })
  const [peserta, setPeserta] = useState(null)
  const { data, loading, error, reload } = useLoad(async () => {
    const [kegiatan, ikut, pasien, sumber, rek] = await Promise.all([
      supabase.from('activities').select('*').order('activity_date', { ascending: false }).then(cek),
      peran.staf || peran.sendiri ? supabase.from('activity_participants').select('*').then(cek) : [],
      muatNamaPasien(peran),
      supabase.from('community_resources').select('id, name').order('name').then(cek),
      peran.sendiri
        ? supabase
            .from('foot_visits')
            .select('visit_date, assessments(activity_recommendation, assessed_at)')
            .eq('patient_id', peran.profile.patient_id)
            .order('visit_date', { ascending: false })
            .limit(10)
            .then(cek)
        : [],
    ])
    const rekomendasi = rek.map((r) => satuPenilaian(r.assessments)).find((a) => a?.activity_recommendation) ?? null
    return { kegiatan, ikut, pasien, sumber, rekomendasi }
  }, [])
  const [hapus, dialogHapus] = useHapus('activities', reload)

  if (loading && !data) return <Spinner />
  if (error) return <Banner tone="danger">{error}</Banner>

  const hariIni = hariIniWIB()
  const akanDatang = data.kegiatan.filter((k) => k.activity_date >= hariIni).reverse()
  const lewat = data.kegiatan.filter((k) => k.activity_date < hariIni).slice(0, 10)
  const pid = peran.profile.patient_id

  async function daftar(k, ikut) {
    const { error: err } = ikut
      ? await supabase.from('activity_participants').insert({ activity_id: k.id, patient_id: pid })
      : await supabase.from('activity_participants').delete().eq('activity_id', k.id).eq('patient_id', pid)
    if (err) return toast.gagal(pesanError(err))
    toast.sukses(ikut ? 'Anda terdaftar. Kader akan mencatat kehadiran.' : 'Pendaftaran dibatalkan.')
    reload()
  }

  const fields = [
    { name: 'title', label: 'Nama kegiatan', required: true, placeholder: 'Contoh: Senam lansia duduk' },
    { name: 'activity_type', label: 'Jenis', type: 'select', required: true, options: opsi(JENIS_KEGIATAN) },
    { name: 'activity_date', label: 'Tanggal', type: 'date', required: true },
    { name: 'start_time', label: 'Jam', type: 'time' },
    { name: 'location', label: 'Tempat' },
    { name: 'person_in_charge', label: 'Penanggung jawab' },
    { name: 'resource_id', label: 'Diselenggarakan oleh', type: 'select', options: data.sumber.map((s) => ({ value: s.id, label: s.name })) },
    { name: 'description', label: 'Keterangan', type: 'textarea', hint: 'Misalnya: gerakan disesuaikan rekomendasi perawat, aman untuk pasien luka kaki.' },
  ]
  async function simpan(v) {
    const d = {
      title: v.title.trim(),
      activity_type: v.activity_type,
      activity_date: v.activity_date,
      start_time: v.start_time || null,
      location: teks(v.location),
      person_in_charge: teks(v.person_in_charge),
      resource_id: v.resource_id || null,
      description: teks(v.description),
    }
    const { error: err } = form.awal ? await supabase.from('activities').update(d).eq('id', form.awal.id) : await supabase.from('activities').insert(d)
    if (err) throw new Error(pesanError(err))
    toast.sukses('Kegiatan disimpan.')
    reload()
  }

  const kartu = (k) => {
    const ikut = data.ikut.filter((p) => p.activity_id === k.id)
    const saya = pid ? ikut.find((p) => p.patient_id === pid) : null
    const akanDatangK = k.activity_date >= hariIni
    return (
      <li key={k.id} className="rounded-card border border-line bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-base text-muted">
              {formatTanggal(k.activity_date, { year: undefined })}
              {k.start_time && ` · ${formatJam(k.start_time)}`}
              {k.location && ` · ${k.location}`}
            </p>
            <p className="text-lg leading-snug font-extrabold">{k.title}</p>
            {k.description && <p className="mt-1">{k.description}</p>}
            {k.person_in_charge && <p className="text-muted">PJ: {k.person_in_charge}</p>}
          </div>
          <Badge tone="neutral">{JENIS_KEGIATAN[k.activity_type]}</Badge>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {peran.staf && (
            <Badge tone="primary" icon={Users}>
              {ikut.filter((p) => p.attended).length}/{ikut.length} hadir
            </Badge>
          )}
          {saya && <Badge tone={saya.attended ? 'success' : 'warning'}>{saya.attended ? 'Anda hadir' : 'Anda terdaftar'}</Badge>}
          {peran.sendiri && akanDatangK && !saya && (
            <Button size="sm" icon={UserPlus} onClick={() => daftar(k, true)}>
              Daftar ikut
            </Button>
          )}
          {peran.sendiri && akanDatangK && saya && saya.attended === null && (
            <Button size="sm" variant="quiet" onClick={() => daftar(k, false)}>
              Batal daftar
            </Button>
          )}
          {bolehKelola && (
            <Button size="sm" variant="soft" icon={Users} onClick={() => setPeserta(k)}>
              Peserta & kehadiran
            </Button>
          )}
        </div>
        {bolehKelola && <AksiKelola onUbah={() => setForm({ open: true, awal: k })} onHapus={() => hapus({ id: k.id, label: k.title })} />}
      </li>
    )
  }

  return (
    <div className="space-y-5">
      {data.rekomendasi && (
        <Banner tone="success" title="Rekomendasi aktivitas dari perawat">
          {data.rekomendasi.activity_recommendation}
        </Banner>
      )}
      {bolehKelola && (
        <Button icon={Plus} onClick={() => setForm({ open: true, awal: null })}>
          Tambah kegiatan
        </Button>
      )}
      <section>
        <h2 className="mb-3 text-xl font-extrabold">Akan datang</h2>
        {akanDatang.length ? <ul className="space-y-3">{akanDatang.map(kartu)}</ul> : <EmptyState icon={CalendarDays} title="Belum ada kegiatan berikutnya" />}
      </section>
      {lewat.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-extrabold">Sudah lewat</h2>
          <ul className="space-y-3">{lewat.map(kartu)}</ul>
        </section>
      )}
      <FormModal
        open={form.open}
        onClose={() => setForm({ open: false, awal: null })}
        title={form.awal ? 'Ubah kegiatan' : 'Tambah kegiatan'}
        fields={fields}
        initial={form.awal ? { ...form.awal, start_time: form.awal.start_time?.slice(0, 5) ?? '', resource_id: form.awal.resource_id ?? '' } : { activity_type: 'senam_lansia' }}
        onSubmit={simpan}
      />
      <PesertaModal open={Boolean(peserta)} onClose={() => setPeserta(null)} kegiatan={peserta} peserta={data.ikut} pasien={data.pasien} onChanged={reload} />
      {dialogHapus}
    </div>
  )
}

// ============================================================================
// Direktori sumber daya desa (PEM-01) + dokumen kebijakan (PEM-07)
// ============================================================================
function TabSumber({ bolehKelola }) {
  const toast = useToast()
  const [jenis, setJenis] = useState('semua')
  const [form, setForm] = useState({ open: false, awal: null })
  const { data, loading, error, reload } = useLoad(() => supabase.from('community_resources').select('*').order('name').then(cek), [])
  const [hapus, dialogHapus] = useHapus('community_resources', reload)
  const daftar = useMemo(() => (data ?? []).filter((r) => jenis === 'semua' || r.resource_type === jenis), [data, jenis])

  const fields = [
    { name: 'resource_type', label: 'Jenis', type: 'select', required: true, options: opsi(JENIS_SUMBER) },
    { name: 'name', label: 'Nama', required: true, placeholder: 'Contoh: Posbindu PTM Dusun Krajan' },
    { name: 'description', label: 'Keterangan', type: 'textarea', rows: 2 },
    { name: 'schedule', label: 'Jadwal', placeholder: 'Contoh: Setiap Kamis minggu pertama, 08.00' },
    { name: 'location', label: 'Lokasi' },
    { name: 'contact', label: 'Kontak (nomor HP)', type: 'tel' },
    { name: 'document_url', label: 'Tautan dokumen', type: 'url', hint: 'Untuk dokumen kebijakan: link Google Drive/PDF (mis. SK Kepala Desa).' },
  ]
  async function simpan(v) {
    const d = {
      resource_type: v.resource_type,
      name: v.name.trim(),
      description: teks(v.description),
      schedule: teks(v.schedule),
      location: teks(v.location),
      contact: teks(v.contact),
      document_url: teks(v.document_url),
    }
    if (d.document_url && !/^https?:\/\//.test(d.document_url)) throw new Error('Tautan dokumen harus diawali https://')
    const { error: err } = form.awal ? await supabase.from('community_resources').update(d).eq('id', form.awal.id) : await supabase.from('community_resources').insert(d)
    if (err) throw new Error(pesanError(err))
    toast.sukses('Sumber daya disimpan.')
    reload()
  }

  if (loading && !data) return <Spinner />
  if (error) return <Banner tone="danger">{error}</Banner>
  const adaJenis = [...new Set(data.map((r) => r.resource_type))]

  return (
    <div className="space-y-4">
      {bolehKelola && (
        <Button icon={Plus} onClick={() => setForm({ open: true, awal: null })}>
          Tambah sumber daya
        </Button>
      )}
      {adaJenis.length > 1 && (
        <Select label="Saring jenis" value={jenis} onChange={(e) => setJenis(e.target.value)} className="max-w-sm">
          <option value="semua">Semua jenis</option>
          {adaJenis.map((j) => (
            <option key={j} value={j}>
              {JENIS_SUMBER[j]}
            </option>
          ))}
        </Select>
      )}
      {daftar.length === 0 ? (
        <EmptyState icon={Landmark} title="Belum ada data sumber daya desa">
          Tambahkan Posbindu, PKK, komunitas senam lansia, Puskesmas, sumber dana, dan dokumen kebijakan.
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {daftar.map((r) => (
            <li key={r.id} className="rounded-card border border-line bg-surface p-4 shadow-card">
              <Badge tone={r.resource_type === 'kebijakan' ? 'warning' : 'primary'}>{JENIS_SUMBER[r.resource_type]}</Badge>
              <p className="mt-2 text-lg leading-snug font-extrabold">{r.name}</p>
              {r.description && <p>{r.description}</p>}
              {r.schedule && <p className="text-muted">Jadwal: {r.schedule}</p>}
              {r.location && <p className="text-muted">Lokasi: {r.location}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {r.contact && /\d{8,}/.test(r.contact.replace(/\D/g, '')) && <TombolKontak phone={r.contact} nama={r.name} />}
                {r.document_url && (
                  <a href={r.document_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-line bg-surface px-4 font-bold hover:bg-soft">
                    <ExternalLink aria-hidden="true" className="size-5 text-primary" /> Buka dokumen
                  </a>
                )}
              </div>
              {bolehKelola && <AksiKelola onUbah={() => setForm({ open: true, awal: r })} onHapus={() => hapus({ id: r.id, label: r.name })} />}
            </li>
          ))}
        </ul>
      )}
      <FormModal open={form.open} onClose={() => setForm({ open: false, awal: null })} title={form.awal ? 'Ubah sumber daya' : 'Tambah sumber daya desa'} fields={fields} initial={form.awal ?? {}} onSubmit={simpan} />
      {dialogHapus}
    </div>
  )
}

// ============================================================================
// Pelatihan kader (PEM-05)
// ============================================================================
function TabPelatihan({ peran, bolehKelola }) {
  const toast = useToast()
  const [form, setForm] = useState({ open: false, awal: null })
  const { data, loading, error, reload } = useLoad(async () => {
    if (!peran.approved) return null
    const [latih, kader] = await Promise.all([
      supabase.from('kader_trainings').select('*').order('training_date', { ascending: false }).then(cek),
      peran.staf ? supabase.from('profiles').select('id, full_name').eq('role', 'kader').eq('approval_status', 'disetujui').order('full_name').then(cek) : [],
    ])
    return { latih, kader }
  }, [])
  const [hapus, dialogHapus] = useHapus('kader_trainings', reload)

  if (!peran.approved) return <EmptyState icon={GraduationCap} title="Data pelatihan tampil setelah akun disetujui" />
  if (loading && !data) return <Spinner />
  if (error) return <Banner tone="danger">{error}</Banner>
  const namaKader = Object.fromEntries(data.kader.map((k) => [k.id, k.full_name]))

  const fields = [
    { name: 'training_date', label: 'Tanggal', type: 'date', required: true },
    { name: 'title', label: 'Judul pelatihan', required: true, placeholder: 'Contoh: Pelatihan Kartu Kaki Sehat' },
    { name: 'topics', label: 'Materi', type: 'multi', options: MATERI },
    { name: 'trainer', label: 'Pelatih', placeholder: 'Contoh: Ns. Cindy' },
    { name: 'location', label: 'Tempat' },
    { name: 'participant_ids', label: 'Kader yang ikut (punya akun)', type: 'multi', options: Object.fromEntries(data.kader.map((k) => [k.id, k.full_name])) },
    { name: 'participant_names', label: 'Peserta lain (tanpa akun)', type: 'textarea', rows: 3, hint: 'Satu nama per baris, misalnya anggota PKK.' },
    { name: 'substitute_kaders', label: 'Kader pengganti', type: 'textarea', rows: 2, hint: 'Kader cadangan bila pendamping berhalangan.' },
    { name: 'notes', label: 'Catatan', type: 'textarea', rows: 2 },
  ]
  async function simpan(v) {
    const d = {
      training_date: v.training_date,
      title: v.title.trim(),
      topics: v.topics ?? [],
      trainer: teks(v.trainer),
      location: teks(v.location),
      participant_ids: v.participant_ids ?? [],
      participant_names: String(v.participant_names ?? '').split('\n').map((s) => s.trim()).filter(Boolean),
      substitute_kaders: teks(v.substitute_kaders),
      notes: teks(v.notes),
    }
    const { error: err } = form.awal ? await supabase.from('kader_trainings').update(d).eq('id', form.awal.id) : await supabase.from('kader_trainings').insert(d)
    if (err) throw new Error(pesanError(err))
    toast.sukses('Pelatihan disimpan.')
    reload()
  }

  const totalTerlatih = new Set([...data.latih.flatMap((l) => l.participant_ids), ...data.latih.flatMap((l) => l.participant_names.map((n) => n.toLowerCase()))]).size

  return (
    <div className="space-y-4">
      <Card className="flex items-center gap-3">
        <GraduationCap aria-hidden="true" className="size-8 text-primary" />
        <p className="text-lg">
          <strong>{totalTerlatih}</strong> kader & pendamping sudah mendapat pelatihan.
        </p>
      </Card>
      {bolehKelola && (
        <Button icon={Plus} onClick={() => setForm({ open: true, awal: null })}>
          Catat pelatihan
        </Button>
      )}
      {data.latih.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Belum ada pelatihan tercatat" />
      ) : (
        <ul className="space-y-3">
          {data.latih.map((l) => {
            const peserta = [...l.participant_ids.map((id) => namaKader[id] ?? 'Kader'), ...l.participant_names]
            return (
              <li key={l.id} className="rounded-card border border-line bg-surface p-4 shadow-card">
                <p className="text-base text-muted">
                  {formatTanggal(l.training_date)}
                  {l.location && ` · ${l.location}`}
                </p>
                <p className="text-lg leading-snug font-extrabold">{l.title}</p>
                {l.trainer && <p className="text-muted">Pelatih: {l.trainer}</p>}
                {l.topics.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {l.topics.map((t) => (
                      <Badge key={t} tone="primary">
                        {MATERI[t] ?? t}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="mt-2">
                  <strong>Peserta ({peserta.length}):</strong> {peserta.join(', ') || '-'}
                </p>
                {l.substitute_kaders && (
                  <p>
                    <strong>Kader pengganti:</strong> {l.substitute_kaders}
                  </p>
                )}
                {bolehKelola && (
                  <AksiKelola
                    onUbah={() => setForm({ open: true, awal: { ...l, participant_names: l.participant_names.join('\n') } })}
                    onHapus={() => hapus({ id: l.id, label: l.title })}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
      <FormModal open={form.open} onClose={() => setForm({ open: false, awal: null })} title={form.awal ? 'Ubah pelatihan' : 'Catat pelatihan kader'} fields={fields} initial={form.awal ?? { training_date: hariIniWIB() }} onSubmit={simpan} />
      {dialogHapus}
    </div>
  )
}

// ============================================================================
// Rapat koordinasi Siaga Kaki (PEM-06)
// ============================================================================
function TabRapat({ peran, bolehKelola }) {
  const toast = useToast()
  const [form, setForm] = useState({ open: false, awal: null })
  const { data, loading, error, reload } = useLoad(
    () => (peran.approved ? supabase.from('coordination_meetings').select('*').order('meeting_date', { ascending: false }).then(cek) : []),
    [],
  )
  const [hapus, dialogHapus] = useHapus('coordination_meetings', reload)
  const fields = [
    { name: 'meeting_date', label: 'Tanggal rapat', type: 'date', required: true },
    { name: 'title', label: 'Judul', required: true },
    { name: 'location', label: 'Tempat' },
    { name: 'attendees', label: 'Peserta', type: 'textarea', rows: 2, hint: 'Perawat, kader, PKK, perangkat desa yang hadir.' },
    { name: 'minutes', label: 'Notulen', type: 'textarea', rows: 5, hint: 'Hindari menulis data pribadi pasien yang tidak perlu.' },
    { name: 'decisions', label: 'Keputusan / tindak lanjut', type: 'textarea', rows: 3 },
  ]
  async function simpan(v) {
    const d = { meeting_date: v.meeting_date, title: v.title.trim(), location: teks(v.location), attendees: teks(v.attendees), minutes: teks(v.minutes), decisions: teks(v.decisions) }
    const { error: err } = form.awal ? await supabase.from('coordination_meetings').update(d).eq('id', form.awal.id) : await supabase.from('coordination_meetings').insert(d)
    if (err) throw new Error(pesanError(err))
    toast.sukses('Rapat disimpan.')
    reload()
  }

  if (!peran.approved) return <EmptyState icon={Users} title="Notulen rapat tampil setelah akun disetujui" />
  if (loading && !data) return <Spinner />
  if (error) return <Banner tone="danger">{error}</Banner>
  return (
    <div className="space-y-4">
      {bolehKelola && (
        <Button icon={Plus} onClick={() => setForm({ open: true, awal: null })}>
          Catat rapat
        </Button>
      )}
      {data.length === 0 ? (
        <EmptyState icon={Users} title="Belum ada rapat Siaga Kaki tercatat" />
      ) : (
        <ul className="space-y-3">
          {data.map((r) => (
            <li key={r.id} className="rounded-card border border-line bg-surface p-4 shadow-card">
              <p className="text-base text-muted">
                {formatTanggal(r.meeting_date)}
                {r.location && ` · ${r.location}`}
              </p>
              <p className="text-lg leading-snug font-extrabold">{r.title}</p>
              {r.attendees && <p className="text-muted">Peserta: {r.attendees}</p>}
              {r.minutes && <p className="mt-2 whitespace-pre-line">{r.minutes}</p>}
              {r.decisions && (
                <p className="mt-2 whitespace-pre-line">
                  <strong>Keputusan:</strong> {r.decisions}
                </p>
              )}
              {bolehKelola && <AksiKelola onUbah={() => setForm({ open: true, awal: r })} onHapus={() => hapus({ id: r.id, label: `${r.title} ${formatTanggalPendek(r.meeting_date)}` })} />}
            </li>
          ))}
        </ul>
      )}
      <FormModal open={form.open} onClose={() => setForm({ open: false, awal: null })} title={form.awal ? 'Ubah rapat' : 'Catat rapat Siaga Kaki'} fields={fields} initial={form.awal ?? { meeting_date: hariIniWIB(), title: 'Rapat Siaga Kaki' }} onSubmit={simpan} />
      {dialogHapus}
    </div>
  )
}

// ============================================================================
export default function Pemberdayaan() {
  const peran = usePeran()
  const bolehKelola = useCan('pemberdayaan.kelola')
  const [tab, setTab] = useState('kegiatan')
  return (
    <div className="space-y-5">
      <PageHeader
        title="Pemberdayaan Desa"
        description="Menghubungkan pasien dengan sumber daya desa: kegiatan, komunitas, pelatihan kader, dan koordinasi."
        menu="pemberdayaan"
      />
      <Saringan
        label="Bagian"
        value={tab}
        onChange={setTab}
        options={[
          { key: 'kegiatan', label: 'Kegiatan' },
          { key: 'sumber', label: 'Sumber daya desa' },
          { key: 'pelatihan', label: 'Pelatihan kader' },
          { key: 'rapat', label: 'Rapat Siaga Kaki' },
          { key: 'stigma', label: 'Anti-stigma' },
        ]}
      />
      {tab === 'kegiatan' && <TabKegiatan peran={peran} bolehKelola={bolehKelola} />}
      {tab === 'sumber' && <TabSumber bolehKelola={bolehKelola} />}
      {tab === 'pelatihan' && <TabPelatihan peran={peran} bolehKelola={bolehKelola} />}
      {tab === 'rapat' && <TabRapat peran={peran} bolehKelola={bolehKelola} />}
      {tab === 'stigma' && (
        <div className="space-y-3">
          <p className="text-muted">
            <Sprout aria-hidden="true" className="mr-1 inline size-5 text-primary" />
            Edukasi untuk warga dan keluarga bahwa pasien luka kaki bukan beban, termasuk profil Duta Kaki Sehat.
          </p>
          <ArtikelSection hanyaTab={['anti_stigma']} judul="Edukasi anti-stigma & Duta Kaki Sehat" kategoriBaru="anti_stigma" />
        </div>
      )}
    </div>
  )
}
