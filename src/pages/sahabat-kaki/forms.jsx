import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'
import { pesanError } from '../../lib/errors'
import { hariIniWIB } from '../../lib/format'
import { JENIS_KUNJUNGAN } from '../../lib/pasien'
import { useToast } from '../../context/ToastContext'
import { Button } from '../../components/ui/Button'
import { Select, TextInput, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Banner } from '../../components/ui/misc'
import { PilihanSatu } from '../../components/ui/extra'

// SK-01: Perawat memasangkan pasien dengan satu pendamping (kader/PKK dari RT yang sama)
export function PasangkanForm({ open, onClose, pasien, aktif, onSaved }) {
  const toast = useToast()
  const [kaderList, setKaderList] = useState([])
  const [jenis, setJenis] = useState('kader')
  const [kaderId, setKaderId] = useState('')
  const [nama, setNama] = useState('')
  const [hp, setHp] = useState('')
  const [hubungan, setHubungan] = useState('')
  const [error, setError] = useState('')
  const [simpan, setSimpan] = useState(false)

  useEffect(() => {
    if (!open) return
    setJenis('kader')
    setKaderId('')
    setNama('')
    setHp('')
    setHubungan('')
    setError('')
    supabase
      .from('profiles')
      .select('id, full_name, phone, rt, dusun')
      .eq('role', 'kader')
      .eq('approval_status', 'disetujui')
      .order('full_name')
      .then(({ data }) => {
        const rt = String(pasien?.rt ?? '').replace(/^0+/, '')
        const sama = (k) => String(k.rt ?? '').replace(/^0+/, '') === rt && rt !== ''
        setKaderList([...(data ?? [])].sort((a, b) => Number(sama(b)) - Number(sama(a))).map((k) => ({ ...k, rtSama: sama(k) })))
      })
  }, [open, pasien?.rt])

  const belumSetuju = pasien && !pasien.consent_share

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    let data
    if (jenis === 'kader') {
      const k = kaderList.find((x) => x.id === kaderId)
      if (!k) return setError('Pilih kader pendamping.')
      data = { profile_id: k.id, name: k.full_name, phone: k.phone, rt: k.rt, companion_type: 'kader' }
    } else {
      if (nama.trim().length < 2) return setError('Tulis nama pendamping.')
      data = { profile_id: null, name: nama.trim(), phone: hp.replace(/[\s-]/g, '') || null, rt: pasien.rt, companion_type: 'pkk' }
    }
    setSimpan(true)
    try {
      if (aktif) {
        const { error: e1 } = await supabase
          .from('companions')
          .update({ active: false, ended_at: hariIniWIB() })
          .eq('id', aktif.id)
        if (e1) throw e1
      }
      const { error: e2 } = await supabase
        .from('companions')
        .insert({ ...data, patient_id: pasien.id, relation: hubungan.trim() || null })
      if (e2) {
        if (aktif) await supabase.from('companions').update({ active: true, ended_at: null }).eq('id', aktif.id)
        throw e2
      }
      toast.sukses(`${data.name} sekarang mendampingi ${pasien.full_name}.`)
      onSaved?.()
      onClose()
    } catch (err) {
      setError(pesanError(err))
    } finally {
      setSimpan(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={aktif ? 'Ganti pendamping' : 'Pasangkan pendamping'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={simpan}>
            Batal
          </Button>
          <Button type="submit" form="form-pasangkan" loading={simpan} disabled={belumSetuju}>
            Simpan
          </Button>
        </>
      }
    >
      {pasien && (
        <form id="form-pasangkan" onSubmit={onSubmit} noValidate className="space-y-5">
          <p className="text-lg">
            Pasien: <strong>{pasien.full_name}</strong> (RT {pasien.rt})
          </p>
          {belumSetuju && (
            <Banner tone="warning" title="Belum ada persetujuan berbagi kondisi">
              Pasien/keluarga harus setuju kondisinya dibagikan ke pendamping.{' '}
              <Link to={`/pasien/${pasien.id}/ubah`} className="underline underline-offset-4">
                Isi persetujuan
              </Link>
            </Banner>
          )}
          {aktif && <Banner tone="info">Pendamping sekarang: {aktif.name}. Riwayat kunjungannya tetap tersimpan.</Banner>}
          <PilihanSatu
            legend="Pendamping"
            options={{ kader: 'Kader (punya akun)', pkk: 'Anggota PKK / lainnya' }}
            value={jenis}
            onChange={setJenis}
          />
          {jenis === 'kader' ? (
            <Select label="Pilih kader" value={kaderId} onChange={(e) => setKaderId(e.target.value)} hint="Kader dari RT yang sama ditampilkan paling atas.">
              <option value="">— pilih —</option>
              {kaderList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.full_name}
                  {k.rt ? ` · RT ${k.rt}` : ''}
                  {k.rtSama ? ' (RT sama)' : ''}
                </option>
              ))}
            </Select>
          ) : (
            <>
              <TextInput label="Nama pendamping" value={nama} onChange={(e) => setNama(e.target.value)} />
              <TextInput label="Nomor HP" type="tel" inputMode="tel" value={hp} onChange={(e) => setHp(e.target.value)} />
              <p className="text-muted">
                Pendamping tanpa akun tidak bisa mencatat kunjungan sendiri; kunjungannya dicatat oleh perawat.
              </p>
            </>
          )}
          <TextInput
            label="Hubungan dengan pasien"
            placeholder="Contoh: tetangga satu RT"
            value={hubungan}
            onChange={(e) => setHubungan(e.target.value)}
          />
          {error && (
            <Banner tone="danger">
              <span role="alert">{error}</span>
            </Banner>
          )}
        </form>
      )}
    </Modal>
  )
}

// SK-02: catatan kunjungan mingguan; SK-04: "Lapor ke perawat"
export function KunjunganForm({ open, onClose, pasien, companionId, onSaved }) {
  const toast = useToast()
  const kosong = {
    visit_date: hariIniWIB(),
    activity_type: 'kunjungan_rumah',
    complaints: '',
    support_given: '',
    follow_up_plan: '',
    report_to_nurse: false,
    report_note: '',
  }
  const [form, setForm] = useState(kosong)
  const [error, setError] = useState('')
  const [simpan, setSimpan] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({ ...kosong, visit_date: hariIniWIB() })
      setError('')
    }
  }, [open])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.visit_date) return setError('Isi tanggal kunjungan.')
    if (form.visit_date > hariIniWIB()) return setError('Tanggal kunjungan tidak boleh setelah hari ini.')
    if (form.report_to_nurse && !form.report_note.trim() && !form.complaints.trim()) {
      return setError('Tulis keluhan atau isi laporan untuk perawat.')
    }
    setSimpan(true)
    const { error: err } = await supabase.from('companion_visits').insert({
      patient_id: pasien.id,
      companion_id: companionId ?? null,
      visit_date: form.visit_date,
      activity_type: form.activity_type,
      complaints: form.complaints.trim() || null,
      support_given: form.support_given.trim() || null,
      follow_up_plan: form.follow_up_plan.trim() || null,
      report_to_nurse: form.report_to_nurse,
      report_note: form.report_to_nurse ? form.report_note.trim() || null : null,
    })
    setSimpan(false)
    if (err) return setError(pesanError(err))
    toast.sukses(form.report_to_nurse ? 'Kunjungan dicatat dan perawat sudah diberi tahu.' : 'Kunjungan dicatat.')
    onSaved?.()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Catat kunjungan"
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={simpan}>
            Batal
          </Button>
          <Button type="submit" form="form-kunjungan" loading={simpan}>
            Simpan kunjungan
          </Button>
        </>
      }
    >
      {pasien && (
        <form id="form-kunjungan" onSubmit={onSubmit} noValidate className="space-y-5">
          <p className="text-lg">
            Pasien: <strong>{pasien.full_name}</strong>
          </p>
          <TextInput label="Tanggal" type="date" max={hariIniWIB()} value={form.visit_date} onChange={set('visit_date')} required />
          <PilihanSatu
            legend="Jenis kegiatan"
            options={JENIS_KUNJUNGAN}
            value={form.activity_type}
            onChange={(v) => setForm((f) => ({ ...f, activity_type: v }))}
          />
          <Textarea label="Keluhan yang dilaporkan" rows={3} value={form.complaints} onChange={set('complaints')} />
          <Textarea
            label="Dukungan yang diberikan"
            hint="Contoh: mengingatkan minum obat, membantu memeriksa kaki."
            rows={3}
            value={form.support_given}
            onChange={set('support_given')}
          />
          <Textarea label="Rencana tindak lanjut" rows={2} value={form.follow_up_plan} onChange={set('follow_up_plan')} />
          <div className={`rounded-field border-2 p-4 ${form.report_to_nurse ? 'border-merah-line bg-danger-soft/50' : 'border-line'}`}>
            <label className="flex cursor-pointer gap-3">
              <input
                type="checkbox"
                checked={form.report_to_nurse}
                onChange={(e) => setForm((f) => ({ ...f, report_to_nurse: e.target.checked }))}
                className="mt-1 size-6 shrink-0 accent-primary"
              />
              <span>
                <span className="block font-extrabold">Lapor ke perawat</span>
                <span className="block text-muted">Centang jika ada keluhan atau perubahan kondisi kaki. Perawat langsung mendapat notifikasi.</span>
              </span>
            </label>
            {form.report_to_nurse && (
              <Textarea
                className="mt-4"
                label="Isi laporan untuk perawat"
                rows={3}
                value={form.report_note}
                onChange={set('report_note')}
              />
            )}
          </div>
          {error && (
            <Banner tone="danger">
              <span role="alert">{error}</span>
            </Banner>
          )}
        </form>
      )}
    </Modal>
  )
}
