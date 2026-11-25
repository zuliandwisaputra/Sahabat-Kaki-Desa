import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { CalendarDays, Pencil, Trash2, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cek, useLoad } from '../../lib/useLoad'
import { muatNamaPasien, usePeran } from '../../lib/usePeran'
import { pesanError } from '../../lib/errors'
import { formatJam, formatTanggal } from '../../lib/format'
import { useToast } from '../../context/ToastContext'
import { useCan } from '../../components/Can'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Field'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Badge, Banner, Card, EmptyState, Spinner } from '../../components/ui/misc'
import { Info } from '../../components/ui/extra'
import { AgendaForm, JENIS_AGENDA } from './PosKaki'

function Tombol({ aktif, onClick, children, tone = 'primary' }) {
  const warna = aktif ? (tone === 'danger' ? 'border-danger bg-danger text-white' : 'border-primary bg-primary text-white') : 'border-line bg-surface hover:bg-soft'
  return (
    <button type="button" aria-pressed={aktif} onClick={onClick} className={`min-h-11 rounded-full border-2 px-3 font-bold transition-colors ${warna}`}>
      {children}
    </button>
  )
}

// POS-02: daftar hadir, pemeriksaan kaki & edukasi, penanda kontrol tepat waktu/terlambat
export default function AgendaDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const peran = usePeran()
  const bolehKelola = useCan('pos.kelola')
  const [tambah, setTambah] = useState('')
  const [modal, setModal] = useState(null)
  const [proses, setProses] = useState(false)

  const { data, loading, error, reload } = useLoad(async () => {
    const agenda = await supabase.from('agenda').select('*').eq('id', id).maybeSingle().then(cek)
    if (!agenda) return { agenda: null }
    const [hadir, pasien] = await Promise.all([
      peran.staf || peran.sendiri ? supabase.from('attendance').select('*').eq('agenda_id', id).then(cek) : [],
      muatNamaPasien(peran),
    ])
    return { agenda, hadir, pasien }
  }, [id])

  if (loading && !data) return <Spinner />
  if (error) return <Banner tone="danger">{error}</Banner>
  if (!data?.agenda) return <EmptyState icon={CalendarDays} title="Agenda tidak ditemukan" />

  const a = data.agenda
  const terdaftar = new Set(data.hadir.map((h) => h.patient_id))
  const calon = Object.values(data.pasien).filter((p) => !p.archived_at && !terdaftar.has(p.id))
  const urut = [...data.hadir].sort((x, y) => (data.pasien[x.patient_id]?.full_name ?? '').localeCompare(data.pasien[y.patient_id]?.full_name ?? ''))

  async function ubah(h, perubahan) {
    const { error: err } = await supabase.from('attendance').update(perubahan).eq('id', h.id)
    if (err) return toast.gagal(pesanError(err))
    reload()
  }

  async function tambahPasien() {
    if (!tambah) return
    const { error: err } = await supabase.from('attendance').insert({ agenda_id: id, patient_id: tambah })
    if (err) return toast.gagal(pesanError(err))
    setTambah('')
    toast.sukses('Pasien ditambahkan ke daftar hadir.')
    reload()
  }

  async function hapusAgenda() {
    setProses(true)
    const { error: err } = await supabase.from('agenda').delete().eq('id', id)
    setProses(false)
    if (err) return toast.gagal(pesanError(err))
    toast.sukses('Agenda dihapus.')
    navigate('/pos-kaki', { replace: true })
  }

  return (
    <div className="space-y-5">
      <Link to="/pos-kaki" className="inline-flex min-h-11 items-center font-bold text-primary underline underline-offset-4">
        ← Pos Kaki
      </Link>
      <Card>
        <Badge tone="neutral">{JENIS_AGENDA[a.agenda_type]}</Badge>
        <h1 className="mt-2 text-[26px] leading-tight font-extrabold">{a.title}</h1>
        <dl className="mt-2 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <Info label="Tanggal">
            {formatTanggal(a.event_date)}
            {a.start_time && `, ${formatJam(a.start_time)}${a.end_time ? `–${formatJam(a.end_time)}` : ''}`}
          </Info>
          <Info label="Tempat">{a.location}</Info>
          <Info label="Penanggung jawab">{a.person_in_charge ?? '-'}</Info>
          <Info label="Kunjungan perawat">{a.nurse_visit ? 'Ya' : 'Tidak'}</Info>
          {a.quota && <Info label="Kuota">{a.quota} orang</Info>}
          {a.notes && <Info label="Catatan">{a.notes}</Info>}
        </dl>
        {bolehKelola && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setModal('ubah')}>
              Ubah agenda
            </Button>
            <Button size="sm" variant="quiet" icon={Trash2} className="text-danger" onClick={() => setModal('hapus')}>
              Hapus
            </Button>
          </div>
        )}
      </Card>

      <section aria-labelledby="hadir">
        <h2 id="hadir" className="mb-3 text-xl font-extrabold">
          Daftar hadir {peran.staf && `(${data.hadir.filter((h) => h.present).length}/${data.hadir.length} hadir)`}
        </h2>
        {!peran.staf && !peran.sendiri ? (
          <EmptyState title="Daftar hadir tampil setelah akun disetujui dan terhubung ke data pasien" />
        ) : (
          <>
            {bolehKelola && (
              <div className="mb-4 flex flex-wrap items-end gap-2">
                <Select label="Tambah pasien ke daftar" value={tambah} onChange={(e) => setTambah(e.target.value)} className="min-w-64 flex-1">
                  <option value="">— pilih pasien —</option>
                  {calon.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} · RT {p.rt}
                    </option>
                  ))}
                </Select>
                <Button icon={UserPlus} onClick={tambahPasien} disabled={!tambah}>
                  Tambah
                </Button>
              </div>
            )}
            {urut.length === 0 ? (
              <EmptyState title="Belum ada pasien di daftar hadir" />
            ) : (
              <ul className="space-y-3">
                {urut.map((h) => {
                  const p = data.pasien[h.patient_id]
                  return (
                    <li key={h.id} className="rounded-card border border-line bg-surface p-4 shadow-card">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-lg font-extrabold">{p?.full_name ?? 'Pasien'}</p>
                        <Badge tone={h.present === null ? 'neutral' : h.present ? 'success' : 'danger'}>
                          {h.present === null ? 'Belum dicatat' : h.present ? 'Hadir' : 'Tidak hadir'}
                        </Badge>
                      </div>
                      {bolehKelola ? (
                        <div className="mt-3 space-y-3">
                          <div className="flex flex-wrap gap-2" role="group" aria-label="Kehadiran">
                            <Tombol aktif={h.present === true} onClick={() => ubah(h, { present: true })}>Hadir</Tombol>
                            <Tombol aktif={h.present === false} tone="danger" onClick={() => ubah(h, { present: false, on_time: null, foot_check_done: false })}>
                              Tidak hadir
                            </Tombol>
                          </div>
                          {h.present && (
                            <>
                              <div className="flex flex-wrap gap-2" role="group" aria-label="Ketepatan kontrol">
                                <Tombol aktif={h.on_time === true} onClick={() => ubah(h, { on_time: true })}>Kontrol tepat waktu</Tombol>
                                <Tombol aktif={h.on_time === false} tone="danger" onClick={() => ubah(h, { on_time: false })}>Terlambat</Tombol>
                              </div>
                              <label className="flex min-h-11 cursor-pointer items-center gap-3 font-bold">
                                <input type="checkbox" checked={h.foot_check_done} onChange={(e) => ubah(h, { foot_check_done: e.target.checked })} className="size-6 accent-primary" />
                                Kaki sudah diperiksa
                              </label>
                              <label className="block">
                                <span className="font-bold">Edukasi yang diberikan</span>
                                <input
                                  defaultValue={h.education_given ?? ''}
                                  placeholder="Contoh: cara memilih alas kaki"
                                  onBlur={(e) => e.target.value !== (h.education_given ?? '') && ubah(h, { education_given: e.target.value.trim() || null })}
                                  className="mt-1 min-h-13 w-full rounded-field border-2 border-line bg-surface px-4 text-lg focus:border-primary focus:ring-4 focus:ring-primary-soft focus:outline-none"
                                />
                              </label>
                            </>
                          )}
                        </div>
                      ) : (
                        h.present && (
                          <p className="mt-1 text-muted">
                            {h.on_time === false ? 'Kontrol terlambat' : h.on_time ? 'Kontrol tepat waktu' : ''}
                            {h.foot_check_done && ' · kaki diperiksa'}
                            {h.education_given && ` · edukasi: ${h.education_given}`}
                          </p>
                        )
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </section>

      <AgendaForm open={modal === 'ubah'} awal={a} onClose={() => setModal(null)} onSaved={reload} />
      <ConfirmDialog
        open={modal === 'hapus'}
        onClose={() => setModal(null)}
        onConfirm={hapusAgenda}
        loading={proses}
        danger
        title="Hapus agenda?"
        message="Agenda dan daftar hadirnya akan dihapus."
        confirmLabel="Ya, hapus"
      />
    </div>
  )
}
