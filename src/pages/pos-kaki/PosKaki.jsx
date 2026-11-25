import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Bike, CalendarDays, ChevronRight, MapPin, MessageCircle, Pencil, Plus, Stethoscope, UserRound, Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cek, useLoad } from '../../lib/useLoad'
import { muatNamaPasien, usePeran } from '../../lib/usePeran'
import { pesanError } from '../../lib/errors'
import { formatJam, formatRupiah, formatTanggal, formatTanggalPendek, hariIniWIB } from '../../lib/format'
import { alamatSingkat } from '../../lib/pasien'
import { useToast } from '../../context/ToastContext'
import { useCan } from '../../components/Can'
import { Button } from '../../components/ui/Button'
import { FormModal } from '../../components/ui/FormModal'
import { Badge, Banner, EmptyState, PageHeader, Spinner } from '../../components/ui/misc'
import { Saringan, TombolKontak } from '../../components/ui/extra'
import { FundForm } from '../jimpitan/FundForm'

export const JENIS_AGENDA = {
  pos_kaki: 'Pos Kaki',
  posbindu_ptm: 'Posbindu PTM',
  posyandu_ilp: 'Posyandu ILP',
  kunjungan_perawat: 'Kunjungan perawat',
  lainnya: 'Lainnya',
}
const TUJUAN = { pos_kaki: 'Pos Kaki', puskesmas: 'Puskesmas', rumah_sakit: 'Rumah sakit', lainnya: 'Lainnya' }
const STATUS_RIDE = {
  dipesan: { label: 'Dipesan', tone: 'warning' },
  dijemput: { label: 'Dijemput', tone: 'primary' },
  selesai: { label: 'Selesai', tone: 'success' },
  batal: { label: 'Batal', tone: 'neutral' },
}

// datetime-local <-> ISO
const keLokal = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const jamTanggal = (iso) => formatTanggal(iso, { weekday: 'short', month: 'short', year: undefined, hour: '2-digit', minute: '2-digit' })

// ============================================================================
// Agenda Pos Kaki (POS-01)
// ============================================================================
export function AgendaForm({ open, onClose, awal, onSaved }) {
  const toast = useToast()
  const { data: tempat } = useLoad(
    () => supabase.from('master_options').select('value').eq('category', 'pos_kaki').eq('active', true).then(cek),
    [],
  )
  const fields = [
    { name: 'title', label: 'Nama kegiatan', required: true, placeholder: 'Contoh: Pos Kaki Desember' },
    { name: 'agenda_type', label: 'Jenis', type: 'select', required: true, options: Object.entries(JENIS_AGENDA).map(([value, label]) => ({ value, label })) },
    { name: 'event_date', label: 'Tanggal', type: 'date', required: true },
    { name: 'start_time', label: 'Jam mulai', type: 'time' },
    { name: 'end_time', label: 'Jam selesai', type: 'time' },
    { name: 'location', label: 'Tempat', required: true, list: 'daftar-pos', placeholder: 'Contoh: Balai Desa' },
    { name: 'person_in_charge', label: 'Penanggung jawab' },
    { name: 'nurse_visit', label: 'Ada kunjungan perawat', type: 'checkbox', hint: 'Misalnya kunjungan perawat sebulan sekali.' },
    { name: 'quota', label: 'Kuota peserta', type: 'number' },
    { name: 'notes', label: 'Catatan', type: 'textarea', rows: 2 },
  ]
  async function simpan(v) {
    const data = {
      title: v.title.trim(),
      agenda_type: v.agenda_type,
      event_date: v.event_date,
      start_time: v.start_time || null,
      end_time: v.end_time || null,
      location: v.location.trim(),
      person_in_charge: v.person_in_charge?.trim() || null,
      nurse_visit: Boolean(v.nurse_visit),
      quota: v.quota ? Number(v.quota) : null,
      notes: v.notes?.trim() || null,
    }
    const { error } = awal ? await supabase.from('agenda').update(data).eq('id', awal.id) : await supabase.from('agenda').insert(data)
    if (error) throw new Error(pesanError(error))
    toast.sukses(awal ? 'Agenda diperbarui.' : 'Agenda ditambahkan.')
    onSaved?.()
  }
  return (
    <>
      <datalist id="daftar-pos">
        {(tempat ?? []).map((t) => (
          <option key={t.value} value={t.value} />
        ))}
      </datalist>
      <FormModal
        open={open}
        onClose={onClose}
        title={awal ? 'Ubah agenda' : 'Tambah agenda Pos Kaki'}
        fields={fields}
        initial={awal ? { ...awal, start_time: awal.start_time?.slice(0, 5) ?? '', end_time: awal.end_time?.slice(0, 5) ?? '', quota: awal.quota ?? '' } : { agenda_type: 'pos_kaki' }}
        onSubmit={simpan}
      />
    </>
  )
}

function TabAgenda({ peran, bolehKelola }) {
  const [form, setForm] = useState({ open: false, awal: null })
  const { data, loading, error, reload } = useLoad(async () => {
    const [agenda, hadir] = await Promise.all([
      supabase.from('agenda').select('*').order('event_date', { ascending: false }).then(cek),
      peran.staf || peran.sendiri ? supabase.from('attendance').select('agenda_id, patient_id, present').then(cek) : [],
    ])
    return { agenda, hadir }
  }, [])

  if (loading && !data) return <Spinner />
  if (error) return <Banner tone="danger">{error}</Banner>
  const hariIni = hariIniWIB()
  const akanDatang = data.agenda.filter((a) => a.event_date >= hariIni).reverse()
  const lewat = data.agenda.filter((a) => a.event_date < hariIni)

  const kartu = (a) => {
    const h = data.hadir.filter((x) => x.agenda_id === a.id)
    const milikku = peran.sendiri ? h.find((x) => x.patient_id === peran.profile.patient_id) : null
    return (
      <li key={a.id}>
        <Link to={`/pos-kaki/agenda/${a.id}`} className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card hover:border-primary/40">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-soft text-center leading-tight text-primary">
            <span>
              <span className="block text-xl font-extrabold">{a.event_date.slice(8, 10)}</span>
              <span className="block text-sm font-bold">{formatTanggal(a.event_date, { weekday: undefined, day: undefined, month: 'short', year: undefined })}</span>
            </span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg leading-snug font-extrabold">{a.title}</span>
            <span className="block text-muted">
              {formatTanggal(a.event_date, { year: undefined })}
              {a.start_time && ` · ${formatJam(a.start_time)}`} · {a.location}
            </span>
            <span className="mt-1 flex flex-wrap gap-2">
              <Badge tone="neutral">{JENIS_AGENDA[a.agenda_type]}</Badge>
              {a.nurse_visit && (
                <Badge tone="primary" icon={Stethoscope}>
                  Ada perawat
                </Badge>
              )}
              {peran.staf && <Badge tone="neutral">{h.filter((x) => x.present).length}/{h.length} hadir</Badge>}
              {milikku && <Badge tone={milikku.present ? 'success' : 'warning'}>{milikku.present ? 'Anda hadir' : 'Anda terdaftar'}</Badge>}
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="size-6 shrink-0 text-muted" />
        </Link>
      </li>
    )
  }

  return (
    <div className="space-y-5">
      {bolehKelola && (
        <Button icon={Plus} onClick={() => setForm({ open: true, awal: null })}>
          Tambah agenda
        </Button>
      )}
      <section>
        <h2 className="mb-3 text-xl font-extrabold">Akan datang</h2>
        {akanDatang.length ? <ul className="space-y-3">{akanDatang.map(kartu)}</ul> : <EmptyState icon={CalendarDays} title="Belum ada jadwal berikutnya" />}
      </section>
      {lewat.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-extrabold">Sudah lewat</h2>
          <ul className="space-y-3">{lewat.slice(0, 12).map(kartu)}</ul>
        </section>
      )}
      <AgendaForm open={form.open} awal={form.awal} onClose={() => setForm({ open: false, awal: null })} onSaved={reload} />
    </div>
  )
}

// ============================================================================
// Driver Ojek Sehat (POS-03)
// ============================================================================
function TabDriver({ peran, bolehKelola }) {
  const toast = useToast()
  const [form, setForm] = useState({ open: false, awal: null })
  const { data, loading, error, reload } = useLoad(
    () => (peran.approved ? supabase.from('drivers').select('*').order('active', { ascending: false }).order('name').then(cek) : []),
    [],
  )
  const fields = [
    { name: 'name', label: 'Nama driver', required: true },
    { name: 'phone', label: 'Nomor HP', type: 'tel', required: true },
    { name: 'vehicle_type', label: 'Jenis kendaraan', placeholder: 'Contoh: Motor, mobil bak' },
    { name: 'service_area', label: 'Wilayah layanan', placeholder: 'Contoh: Dusun Krajan & Sumbersari' },
    { name: 'payment_type', label: 'Status', type: 'radio', required: true, options: { relawan: 'Relawan', berbayar: 'Berbayar' } },
    { name: 'active', label: 'Aktif melayani', type: 'checkbox' },
    { name: 'notes', label: 'Catatan', type: 'textarea', rows: 2 },
  ]
  async function simpan(v) {
    const d = {
      name: v.name.trim(),
      phone: v.phone.replace(/[\s-]/g, ''),
      vehicle_type: v.vehicle_type?.trim() || null,
      service_area: v.service_area?.trim() || null,
      payment_type: v.payment_type,
      active: Boolean(v.active),
      notes: v.notes?.trim() || null,
    }
    const { error: err } = form.awal ? await supabase.from('drivers').update(d).eq('id', form.awal.id) : await supabase.from('drivers').insert(d)
    if (err) throw new Error(pesanError(err))
    toast.sukses('Data driver disimpan.')
    reload()
  }

  if (!peran.approved) return <EmptyState icon={Bike} title="Data driver tampil setelah akun disetujui" />
  if (loading && !data) return <Spinner />
  if (error) return <Banner tone="danger">{error}</Banner>
  return (
    <div className="space-y-4">
      {bolehKelola && (
        <Button icon={Plus} onClick={() => setForm({ open: true, awal: null })}>
          Tambah driver
        </Button>
      )}
      {data.length === 0 ? (
        <EmptyState icon={Bike} title="Belum ada driver Ojek Sehat" />
      ) : (
        <ul className="space-y-3">
          {data.map((d) => (
            <li key={d.id} className={`rounded-card border border-line bg-surface p-4 shadow-card ${d.active ? '' : 'opacity-70'}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-extrabold">{d.name}</p>
                  <p className="text-muted">
                    {[d.vehicle_type, d.service_area].filter(Boolean).join(' · ') || 'Ojek Sehat'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={d.payment_type === 'relawan' ? 'success' : 'neutral'}>{d.payment_type === 'relawan' ? 'Relawan' : 'Berbayar'}</Badge>
                  {!d.active && <Badge tone="neutral">Tidak aktif</Badge>}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <TombolKontak phone={d.phone} nama={d.name} pesan="Halo, saya dari Sahabat Kaki Desa ingin memesan Ojek Sehat." />
                {bolehKelola && (
                  <Button size="sm" variant="quiet" icon={Pencil} onClick={() => setForm({ open: true, awal: d })}>
                    Ubah
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <FormModal
        open={form.open}
        onClose={() => setForm({ open: false, awal: null })}
        title={form.awal ? 'Ubah driver' : 'Tambah driver Ojek Sehat'}
        fields={fields}
        initial={form.awal ?? { payment_type: 'relawan', active: true }}
        onSubmit={simpan}
      />
    </div>
  )
}

// ============================================================================
// Pemesanan Ojek Sehat (POS-04) + kaitan ke Jimpitan (JIM-03)
// ============================================================================
function TabOjek({ peran, bolehKelola }) {
  const toast = useToast()
  const bolehCatatDana = useCan('jimpitan.catat')
  const [filter, setFilter] = useState('aktif')
  const [form, setForm] = useState({ open: false, awal: null })
  const [dana, setDana] = useState(null) // preset FundForm

  const { data, loading, error, reload } = useLoad(async () => {
    if (!peran.staf && !peran.sendiri) return null
    const [rides, pasien, drivers, agenda, funds] = await Promise.all([
      supabase.from('rides').select('*').order('scheduled_at', { ascending: false }).limit(300).then(cek),
      muatNamaPasien(peran),
      supabase.from('drivers').select('id, name, phone, active').order('name').then(cek),
      supabase.from('agenda').select('id, title, event_date, start_time, location').gte('event_date', hariIniWIB()).order('event_date').then(cek),
      supabase.from('funds').select('id, ride_id, amount').not('ride_id', 'is', null).then(cek),
    ])
    return { rides, pasien, drivers, agenda, dana: Object.fromEntries(funds.map((f) => [f.ride_id, f])) }
  }, [peran.staf, peran.sendiri])

  const daftar = useMemo(() => {
    const r = data?.rides ?? []
    if (filter === 'aktif') return r.filter((x) => ['dipesan', 'dijemput'].includes(x.status))
    if (filter === 'selesai') return r.filter((x) => x.status === 'selesai')
    if (filter === 'belum-dicatat') return r.filter((x) => x.status === 'selesai' && !data.dana[x.id])
    return r
  }, [data, filter])

  if (!peran.staf && !peran.sendiri) return <EmptyState icon={Bike} title="Data pemesanan belum bisa ditampilkan" />
  if (loading && !data) return <Spinner />
  if (error) return <Banner tone="danger">{error}</Banner>

  const driverMap = Object.fromEntries(data.drivers.map((d) => [d.id, d]))
  const pasienAktif = Object.values(data.pasien).filter((p) => !p.archived_at)
  const fields = [
    { name: 'patient_id', label: 'Pasien', type: 'select', required: true, options: pasienAktif.map((p) => ({ value: p.id, label: `${p.full_name} · RT ${p.rt}` })) },
    { name: 'agenda_id', label: 'Untuk agenda', type: 'select', hint: 'Opsional, misalnya Pos Kaki berikutnya.', options: data.agenda.map((a) => ({ value: a.id, label: `${a.title} · ${formatTanggalPendek(a.event_date)}` })) },
    { name: 'pickup_from', label: 'Jemput dari', required: true, placeholder: 'Contoh: rumah, Gang Melati RT 02' },
    { name: 'destination', label: 'Tujuan', type: 'radio', required: true, options: TUJUAN },
    { name: 'destination_detail', label: 'Keterangan tujuan', placeholder: 'Contoh: Balai Desa' },
    { name: 'scheduled_at', label: 'Jadwal jemput', type: 'datetime-local', required: true },
    { name: 'driver_id', label: 'Driver', type: 'select', options: data.drivers.filter((d) => d.active || d.id === form.awal?.driver_id).map((d) => ({ value: d.id, label: d.name })) },
    { name: 'estimated_cost', label: 'Perkiraan biaya (Rp)', type: 'number', hint: 'Isi 0 jika driver relawan tanpa biaya.' },
    { name: 'notes', label: 'Catatan', type: 'textarea', rows: 2 },
  ]

  async function simpan(v) {
    const d = {
      patient_id: v.patient_id,
      agenda_id: v.agenda_id || null,
      pickup_from: v.pickup_from.trim(),
      destination: v.destination,
      destination_detail: v.destination_detail?.trim() || null,
      scheduled_at: new Date(v.scheduled_at).toISOString(),
      driver_id: v.driver_id || null,
      estimated_cost: v.estimated_cost === '' || v.estimated_cost === undefined ? null : Number(v.estimated_cost),
      notes: v.notes?.trim() || null,
    }
    const { error: err } = form.awal ? await supabase.from('rides').update(d).eq('id', form.awal.id) : await supabase.from('rides').insert(d)
    if (err) throw new Error(pesanError(err))
    toast.sukses(form.awal ? 'Pemesanan diperbarui.' : 'Ojek Sehat dipesan.')
    reload()
  }

  async function ubahStatus(r, status) {
    const { error: err } = await supabase.from('rides').update({ status }).eq('id', r.id)
    if (err) return toast.gagal(pesanError(err))
    toast.sukses(`Status: ${STATUS_RIDE[status].label}.`)
    reload()
  }

  const belumDicatat = data.rides.filter((x) => x.status === 'selesai' && !data.dana[x.id]).length

  return (
    <div className="space-y-4">
      {bolehKelola && (
        <Button icon={Plus} onClick={() => setForm({ open: true, awal: null })}>
          Pesan Ojek Sehat
        </Button>
      )}
      <Saringan
        label="Saring pemesanan"
        value={filter}
        onChange={setFilter}
        options={[
          { key: 'aktif', label: 'Berjalan' },
          { key: 'selesai', label: 'Selesai' },
          ...(peran.staf ? [{ key: 'belum-dicatat', label: 'Biaya belum dicatat', count: belumDicatat }] : []),
          { key: 'semua', label: 'Semua' },
        ]}
      />
      {daftar.length === 0 ? (
        <EmptyState icon={Bike} title="Tidak ada pemesanan di daftar ini" />
      ) : (
        <ul className="space-y-3">
          {daftar.map((r) => {
            const p = data.pasien[r.patient_id]
            const drv = driverMap[r.driver_id]
            const f = data.dana[r.id]
            const st = STATUS_RIDE[r.status]
            return (
              <li key={r.id} className="rounded-card border border-line bg-surface p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-base text-muted">{jamTanggal(r.scheduled_at)}</p>
                    <p className="text-lg leading-snug font-extrabold">{p?.full_name ?? 'Pasien'}</p>
                    <p className="flex items-start gap-1 text-muted">
                      <MapPin aria-hidden="true" className="mt-1 size-5 shrink-0" />
                      {r.pickup_from} → {TUJUAN[r.destination]}
                      {r.destination_detail && ` (${r.destination_detail})`}
                    </p>
                    <p className="text-muted">
                      Driver: {drv ? drv.name : <span className="font-bold text-warning">belum ditentukan</span>}
                      {r.estimated_cost !== null && ` · ±${formatRupiah(r.estimated_cost)}`}
                    </p>
                  </div>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
                {r.status === 'selesai' && peran.staf && (
                  <div className="mt-2">
                    {f ? (
                      <Badge tone="success" icon={Wallet}>
                        Tercatat di Jimpitan: {formatRupiah(f.amount)}
                      </Badge>
                    ) : bolehCatatDana ? (
                      <Button
                        size="sm"
                        icon={Wallet}
                        onClick={() =>
                          setDana({
                            trx_type: 'keluar',
                            category: 'Ojek Sehat',
                            amount: r.estimated_cost ? String(r.estimated_cost) : '',
                            trx_date: r.scheduled_at ? keLokal(r.scheduled_at).slice(0, 10) : hariIniWIB(),
                            description: `Ojek Sehat ke ${TUJUAN[r.destination]} ${formatTanggalPendek(r.scheduled_at)}`,
                            ride_id: r.id,
                          })
                        }
                      >
                        Catat biaya di Jimpitan
                      </Button>
                    ) : (
                      <Badge tone="warning">Biaya belum dicatat di Jimpitan</Badge>
                    )}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {drv && ['dipesan', 'dijemput'].includes(r.status) && (peran.staf || peran.sendiri) && (
                    <TombolKontak phone={drv.phone} nama={drv.name} pesan={`Halo ${drv.name}, ini dari Sahabat Kaki Desa tentang jemputan Ojek Sehat ${jamTanggal(r.scheduled_at)}.`} />
                  )}
                  {bolehKelola && r.status === 'dipesan' && (
                    <Button size="sm" variant="soft" onClick={() => ubahStatus(r, 'dijemput')}>
                      Sudah dijemput
                    </Button>
                  )}
                  {bolehKelola && r.status === 'dijemput' && (
                    <Button size="sm" variant="soft" onClick={() => ubahStatus(r, 'selesai')}>
                      Selesai
                    </Button>
                  )}
                  {bolehKelola && ['dipesan', 'dijemput'].includes(r.status) && (
                    <>
                      <Button size="sm" variant="quiet" icon={Pencil} onClick={() => setForm({ open: true, awal: r })}>
                        Ubah
                      </Button>
                      <Button size="sm" variant="quiet" className="text-danger" onClick={() => ubahStatus(r, 'batal')}>
                        Batalkan
                      </Button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <FormModal
        open={form.open}
        onClose={() => setForm({ open: false, awal: null })}
        title={form.awal ? 'Ubah pemesanan' : 'Pesan Ojek Sehat'}
        fields={fields}
        initial={
          form.awal
            ? { ...form.awal, scheduled_at: keLokal(form.awal.scheduled_at), estimated_cost: form.awal.estimated_cost ?? '', agenda_id: form.awal.agenda_id ?? '', driver_id: form.awal.driver_id ?? '' }
            : { destination: 'pos_kaki' }
        }
        onSubmit={simpan}
        validate={(v) => {
          const e = {}
          if (v.patient_id && !v.pickup_from && data.pasien[v.patient_id]) e.pickup_from = `Contoh: ${alamatSingkat(data.pasien[v.patient_id])}`
          return e
        }}
      />
      <FundForm open={Boolean(dana)} preset={dana} onClose={() => setDana(null)} onSaved={reload} />
    </div>
  )
}

// ============================================================================
export default function PosKaki() {
  const peran = usePeran()
  const bolehKelola = useCan('pos.kelola')
  const [tab, setTab] = useState('agenda')
  const { data: wa } = useLoad(
    () => supabase.from('app_settings').select('value').eq('key', 'link_grup_wa').maybeSingle().then(cek),
    [],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pos Kaki & Ojek Sehat"
        description="Jadwal Pos Kaki bersama Posbindu/Posyandu, daftar hadir, dan transportasi pasien."
        menu="pos-kaki"
        actions={
          wa?.value && (
            <a
              href={wa.value}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-13 items-center gap-2 rounded-field border-2 border-line bg-surface px-4 font-bold hover:bg-soft"
            >
              <MessageCircle aria-hidden="true" className="size-6 text-success" /> Grup WA Sahabat Kaki
            </a>
          )
        }
      />
      {peran.role === 'pasien' && !peran.sendiri && (
        <Banner tone="info">
          <UserRound aria-hidden="true" className="mr-1 inline size-5" />
          Hubungkan akun ke data pasien untuk melihat kehadiran dan jemputan Anda.
        </Banner>
      )}
      <Saringan
        label="Bagian"
        value={tab}
        onChange={setTab}
        options={[
          { key: 'agenda', label: 'Agenda & kehadiran' },
          { key: 'ojek', label: 'Ojek Sehat' },
          { key: 'driver', label: 'Driver' },
        ]}
      />
      {tab === 'agenda' && <TabAgenda peran={peran} bolehKelola={bolehKelola} />}
      {tab === 'ojek' && <TabOjek peran={peran} bolehKelola={bolehKelola} />}
      {tab === 'driver' && <TabDriver peran={peran} bolehKelola={bolehKelola} />}
    </div>
  )
}
