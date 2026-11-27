import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, ClipboardCheck, Eye, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cek, useLoad } from '../../lib/useLoad'
import { muatNamaPasien, usePeran } from '../../lib/usePeran'
import { pesanError } from '../../lib/errors'
import { formatTanggalPendek, hariIniWIB } from '../../lib/format'
import { ASPEK_LABEL, hitungSkor, INSTRUMEN, kategoriMspss, opsiButir } from '../../lib/kuesioner'
import { useToast } from '../../context/ToastContext'
import { useCan } from '../../components/Can'
import { Button } from '../../components/ui/Button'
import { Select, TextInput, Textarea } from '../../components/ui/Field'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Badge, Banner, Card, EmptyState, PageHeader, Spinner } from '../../components/ui/misc'
import { PilihanSatu } from '../../components/ui/extra'

const fmt = (x, aspek) => (x === null || x === undefined ? '-' : aspek === 'kualitas_hidup' ? Number(x).toFixed(1) : Number(x).toFixed(2))

function Perubahan({ awal, ulang }) {
  if (awal === null || awal === undefined || ulang === null || ulang === undefined) return <span className="text-muted">-</span>
  const d = Number(ulang) - Number(awal)
  const Icon = d > 0 ? ArrowUp : d < 0 ? ArrowDown : ArrowRight
  return (
    <span className={`inline-flex items-center gap-1 font-bold ${d > 0 ? 'text-success' : d < 0 ? 'text-danger' : 'text-muted'}`}>
      <Icon aria-hidden="true" className="size-5" />
      {d > 0 ? 'Naik' : d < 0 ? 'Turun' : 'Tetap'} {d !== 0 && Math.abs(d).toFixed(2)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Form pengisian (KUE-01, KUE-02, KUE-03)
// ---------------------------------------------------------------------------
function FormKuesioner({ open, onClose, pasienList, pasienAwal, riwayat, onSaved }) {
  const toast = useToast()
  const [pasien, setPasien] = useState('')
  const [aspek, setAspek] = useState('kualitas_hidup')
  const [jenis, setJenis] = useState('awal')
  const [tanggal, setTanggal] = useState(hariIniWIB())
  const [jawaban, setJawaban] = useState({})
  const [catatan, setCatatan] = useState('')
  const [error, setError] = useState('')
  const [simpan, setSimpan] = useState(false)

  useEffect(() => {
    if (!open) return
    setPasien(pasienAwal ?? '')
    setAspek('kualitas_hidup')
    setTanggal(hariIniWIB())
    setJawaban({})
    setCatatan('')
    setError('')
  }, [open, pasienAwal])

  // KUE-02: awal saat terdaftar, ulang tiap 3 bulan — jenis disarankan otomatis
  useEffect(() => {
    const sudahAwal = riwayat.some((q) => q.patient_id === pasien && q.aspect === aspek && q.assessment_type === 'awal')
    setJenis(sudahAwal ? 'ulang' : 'awal')
    setJawaban({})
  }, [pasien, aspek, riwayat])

  const ins = INSTRUMEN[aspek]
  const hasil = hitungSkor(aspek, jawaban)
  const terisi = Object.keys(jawaban).length

  async function kirim(e) {
    e.preventDefault()
    setError('')
    if (!pasien) return setError('Pilih pasien.')
    if (!hasil.lengkap) return setError(`Masih ada ${ins.butir.length - terisi} butir yang belum dijawab.`)
    setSimpan(true)
    const { error: err } = await supabase.from('questionnaires').insert({
      patient_id: pasien,
      aspect: aspek,
      instrument: ins.nama,
      assessment_type: jenis,
      assessed_on: tanggal,
      answers: jawaban,
      score: hasil.skor,
      notes: catatan.trim() || null,
    })
    setSimpan(false)
    if (err) return setError(pesanError(err))
    toast.sukses(`Kuesioner ${ins.nama} disimpan. Skor ${fmt(hasil.skor, aspek)}.`)
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Isi kuesioner"
      wide
      footer={
        <>
          <span className="mr-auto self-center font-bold" aria-live="polite">
            {hasil.lengkap ? `Skor ${fmt(hasil.skor, aspek)} ${ins.satuan}` : `${terisi}/${ins.butir.length} terjawab`}
          </span>
          <Button variant="secondary" onClick={onClose} disabled={simpan}>
            Batal
          </Button>
          <Button type="submit" form="form-kuesioner" loading={simpan}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="form-kuesioner" onSubmit={kirim} noValidate className="space-y-5">
        <Select label="Pasien" required value={pasien} onChange={(e) => setPasien(e.target.value)}>
          <option value="">— pilih pasien —</option>
          {pasienList.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name} · RT {p.rt}
            </option>
          ))}
        </Select>
        <PilihanSatu
          legend="Aspek"
          options={Object.fromEntries(Object.entries(INSTRUMEN).map(([k, v]) => [k, `${v.aspek} (${v.nama})`]))}
          value={aspek}
          onChange={setAspek}
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <PilihanSatu
            legend="Jenis penilaian"
            hint="Awal saat terdaftar, ulang setiap 3 bulan."
            options={{ awal: 'Awal', ulang: 'Ulang' }}
            value={jenis}
            onChange={setJenis}
          />
          <TextInput label="Tanggal" type="date" max={hariIniWIB()} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        </div>
        <Banner tone="info" title={`${ins.nama} · ${ins.butir.length} butir`}>
          {ins.petunjuk} {ins.keterangan}
        </Banner>
        <ol className="space-y-5">
          {ins.butir.map((b) => (
            <li key={b.key} className="rounded-field border border-line p-4">
              <PilihanSatu
                legend={`${b.no}. ${b.teks}`}
                options={opsiButir(ins, b)}
                value={jawaban[b.key] !== undefined ? String(jawaban[b.key]) : ''}
                onChange={(v) => setJawaban((j) => ({ ...j, [b.key]: Number(v) }))}
              />
            </li>
          ))}
        </ol>
        {hasil.lengkap && (
          <Card className="border-2 border-primary/40">
            <p className="text-lg font-extrabold">
              Skor {ins.nama}: {fmt(hasil.skor, aspek)} {ins.satuan}
              {hasil.kategori && ` · ${hasil.kategori}`}
            </p>
            <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {Object.entries(hasil.domain).map(([n, v]) => (
                <li key={n}>
                  {n}: <strong>{fmt(v, aspek)}</strong>
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Textarea label="Catatan (opsional)" rows={2} value={catatan} onChange={(e) => setCatatan(e.target.value)} />
        {error && (
          <Banner tone="danger">
            <span role="alert">{error}</span>
          </Banner>
        )}
      </form>
    </Modal>
  )
}

function LihatJawaban({ q, onClose }) {
  if (!q) return null
  const ins = INSTRUMEN[q.aspect]
  const hasil = hitungSkor(q.aspect, q.answers)
  return (
    <Modal open onClose={onClose} title={`${ins.nama} (${q.assessment_type}) · ${formatTanggalPendek(q.assessed_on)}`} wide>
      <p className="text-lg font-extrabold">
        Skor {fmt(q.score, q.aspect)} {ins.satuan}
        {q.aspect === 'dukungan_sosial' && ` · ${kategoriMspss(q.score)}`}
      </p>
      {hasil.lengkap && (
        <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
          {Object.entries(hasil.domain).map(([n, v]) => (
            <li key={n}>
              {n}: <strong>{fmt(v, q.aspect)}</strong>
            </li>
          ))}
        </ul>
      )}
      <ol className="mt-4 divide-y divide-line rounded-field border border-line">
        {ins.butir.map((b) => (
          <li key={b.key} className="flex gap-3 px-4 py-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft font-extrabold text-primary">{q.answers?.[b.key] ?? '-'}</span>
            <span>
              {b.no}. {b.teks}
            </span>
          </li>
        ))}
      </ol>
      {q.notes && <p className="mt-3">Catatan: {q.notes}</p>}
    </Modal>
  )
}

// ---------------------------------------------------------------------------
export default function Kuesioner() {
  const toast = useToast()
  const peran = usePeran()
  const bolehIsi = useCan('kuesioner.isi')
  const lengkap = bolehIsi || peran.sendiri // KUE-04: jawaban lengkap hanya perawat/admin & pasien ybs
  const [pilih, setPilih] = useState('')
  const [form, setForm] = useState(false)
  const [lihat, setLihat] = useState(null)
  const [hapus, setHapus] = useState(null)
  const [proses, setProses] = useState(false)

  const { data, loading, error, reload } = useLoad(async () => {
    if (!peran.approved) return null
    const [rekap, riwayat, pasien] = await Promise.all([
      supabase.rpc('questionnaire_recap').then(cek),
      lengkap ? supabase.from('questionnaires').select('*').order('assessed_on', { ascending: false }).then(cek) : [],
      lengkap ? muatNamaPasien(peran) : {},
    ])
    return { rekap, riwayat, pasien }
  }, [peran.approved, lengkap])

  const pasienId = peran.sendiri ? peran.profile.patient_id : pilih
  const ringkas = useMemo(() => {
    const rows = (data?.riwayat ?? []).filter((q) => q.patient_id === pasienId)
    return Object.keys(INSTRUMEN).map((aspek) => {
      const a = rows.filter((q) => q.aspect === aspek && q.assessment_type === 'awal')[0]
      const u = rows.filter((q) => q.aspect === aspek && q.assessment_type === 'ulang')[0]
      return { aspek, awal: a, ulang: u }
    })
  }, [data, pasienId])

  async function konfirmasiHapus() {
    setProses(true)
    const { error: err } = await supabase.from('questionnaires').delete().eq('id', hapus.id)
    setProses(false)
    if (err) return toast.gagal(pesanError(err))
    toast.sukses('Kuesioner dihapus.')
    setHapus(null)
    reload()
  }

  const pasienList = Object.values(data?.pasien ?? {}).filter((p) => !p.archived_at)
  const riwayatPasien = (data?.riwayat ?? []).filter((q) => q.patient_id === pasienId)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kuesioner"
        description="Kualitas hidup (WHOQOL-BREF), dukungan sosial (MSPSS), dan kemandirian (SDSCA): penilaian awal dan ulang tiap 3 bulan."
        menu="kuesioner"
        actions={
          bolehIsi && (
            <Button icon={Plus} onClick={() => setForm(true)}>
              Isi kuesioner
            </Button>
          )
        }
      />
      {!peran.approved ? (
        <EmptyState icon={ClipboardCheck} title="Kuesioner tampil setelah akun disetujui" />
      ) : loading && !data ? (
        <Spinner />
      ) : error ? (
        <Banner tone="danger">{error}</Banner>
      ) : (
        <>
          {lengkap && (
            <section className="space-y-4">
              {!peran.sendiri && (
                <Select label="Pilih pasien" value={pilih} onChange={(e) => setPilih(e.target.value)} className="max-w-md">
                  <option value="">— pilih pasien —</option>
                  {pasienList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} · RT {p.rt}
                    </option>
                  ))}
                </Select>
              )}
              {pasienId ? (
                <>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                    {ringkas.map(({ aspek, awal, ulang }) => (
                      <Card key={aspek}>
                        <p className="text-base text-muted">{INSTRUMEN[aspek].nama}</p>
                        <p className="text-lg font-extrabold">{ASPEK_LABEL[aspek]}</p>
                        <dl className="mt-2 grid grid-cols-3 gap-2">
                          <div>
                            <dt className="text-base text-muted">Awal</dt>
                            <dd className="text-xl font-extrabold">{fmt(awal?.score, aspek)}</dd>
                          </div>
                          <div>
                            <dt className="text-base text-muted">Ulang</dt>
                            <dd className="text-xl font-extrabold">{fmt(ulang?.score, aspek)}</dd>
                          </div>
                          <div>
                            <dt className="text-base text-muted">Perubahan</dt>
                            <dd>
                              <Perubahan awal={awal?.score} ulang={ulang?.score} />
                            </dd>
                          </div>
                        </dl>
                        <p className="mt-1 text-base text-muted">{INSTRUMEN[aspek].keterangan}</p>
                      </Card>
                    ))}
                  </div>
                  <h2 className="text-xl font-extrabold">Riwayat pengisian</h2>
                  {riwayatPasien.length === 0 ? (
                    <EmptyState icon={ClipboardCheck} title="Belum ada kuesioner untuk pasien ini" />
                  ) : (
                    <ul className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
                      {riwayatPasien.map((q) => (
                        <li key={q.id} className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 last:border-0">
                          <span className="min-w-0 flex-1">
                            <span className="block font-extrabold">
                              {ASPEK_LABEL[q.aspect]} · {q.instrument}
                            </span>
                            <span className="block text-muted">
                              {formatTanggalPendek(q.assessed_on)} · skor {fmt(q.score, q.aspect)}
                            </span>
                          </span>
                          <Badge tone={q.assessment_type === 'awal' ? 'neutral' : 'primary'}>{q.assessment_type === 'awal' ? 'Awal' : 'Ulang'}</Badge>
                          <Button size="sm" variant="quiet" icon={Eye} onClick={() => setLihat(q)}>
                            Jawaban
                          </Button>
                          {bolehIsi && (
                            <Button size="sm" variant="quiet" icon={Trash2} className="text-danger" onClick={() => setHapus(q)}>
                              Hapus
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <EmptyState icon={ClipboardCheck} title="Pilih pasien untuk melihat skornya" />
              )}
            </section>
          )}

          <section aria-labelledby="rekap">
            <h2 id="rekap" className="mb-1 text-xl font-extrabold">
              Rekap semua pasien
            </h2>
            <p className="mb-3 text-muted">Rata-rata skor tanpa identitas pasien.</p>
            {data.rekap.length === 0 ? (
              <EmptyState icon={ClipboardCheck} title="Belum ada kuesioner yang diisi" />
            ) : (
              <ul className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
                {data.rekap.map((r) => (
                  <li key={`${r.aspect}-${r.assessment_type}-${r.instrument}`} className="border-b border-line px-4 py-3 last:border-0">
                    <p className="font-extrabold">
                      {ASPEK_LABEL[r.aspect]} · {r.instrument} ({r.assessment_type})
                    </p>
                    <p className="text-muted">
                      {r.jumlah} pasien · rata-rata <strong className="text-ink">{fmt(r.rata_rata, r.aspect)}</strong> (terendah {fmt(r.terendah, r.aspect)}, tertinggi {fmt(r.tertinggi, r.aspect)})
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {bolehIsi && data && (
        <FormKuesioner open={form} onClose={() => setForm(false)} pasienList={pasienList} pasienAwal={pilih} riwayat={data.riwayat} onSaved={reload} />
      )}
      <LihatJawaban q={lihat} onClose={() => setLihat(null)} />
      <ConfirmDialog
        open={Boolean(hapus)}
        onClose={() => setHapus(null)}
        onConfirm={konfirmasiHapus}
        loading={proses}
        danger
        title="Hapus kuesioner?"
        message="Jawaban dan skor kuesioner ini akan dihapus."
        confirmLabel="Ya, hapus"
      />
    </div>
  )
}
