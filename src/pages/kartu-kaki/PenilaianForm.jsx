import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { pesanError } from '../../lib/errors'
import { hariIniWIB } from '../../lib/format'
import { useToast } from '../../context/ToastContext'
import { Button } from '../../components/ui/Button'
import { TextInput, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Banner, KODE_WARNA } from '../../components/ui/misc'

// KKS-03: panduan kode warna untuk perawat (teks bantuan).
// Ukuran pembeda rinci belum dijabarkan di makalah (subbab 4.3 poin 4);
// setelah kelompok menyusunnya, cukup lengkapi teks di bawah ini.
export const PANDUAN_KODE = {
  hijau: 'Lanjut perawatan dan kontrol sesuai jadwal.',
  kuning: 'Kader/perawat memberi arahan dan menjadwalkan pemeriksaan.',
  merah: 'Pasien segera ke tenaga kesehatan; pertimbangkan rujukan ke Puskesmas/RS.',
}

const KOSONG = {
  color_code: '',
  sbar_situation: '',
  sbar_background: '',
  sbar_assessment: '',
  sbar_recommendation: '',
  follow_up_instruction: '',
  referral: false,
  referral_to: '',
  activity_recommendation: '',
  next_control_date: '',
  wound_care_schedule: '',
}

// KKS-03/04/05: hanya perawat (dan admin) yang memberi kode warna dan SBAR.
// Penilaian disimpan di tabel terpisah, jadi catatan kader tidak tertimpa.
export function PenilaianForm({ open, onClose, kartu, pasien, penilaian, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(KOSONG)
  const [errors, setErrors] = useState({})
  const [umum, setUmum] = useState('')
  const [simpan, setSimpan] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    setUmum('')
    if (penilaian) {
      const f = { ...KOSONG }
      for (const k of Object.keys(KOSONG)) f[k] = penilaian[k] ?? KOSONG[k]
      setForm(f)
    } else {
      // Isi awal "Background" dari riwayat pasien supaya perawat tidak mengetik ulang
      const latar = [pasien?.diabetes_since_year && `DM sejak ${pasien.diabetes_since_year}`, pasien?.medical_history]
        .filter(Boolean)
        .join('. ')
      setForm({ ...KOSONG, sbar_background: latar })
    }
  }, [open, penilaian, pasien])

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: undefined }))
  }

  function pilihKode(kode) {
    setForm((f) => ({ ...f, color_code: kode, referral: kode === 'merah' ? true : f.referral }))
    setErrors((er) => ({ ...er, color_code: undefined }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setUmum('')
    const er = {}
    if (!form.color_code) er.color_code = 'Pilih kode warna.'
    if (!form.follow_up_instruction.trim()) er.follow_up_instruction = 'Tulis arahan tindak lanjut untuk kader/keluarga.'
    if (form.referral && !form.referral_to.trim()) er.referral_to = 'Tulis tujuan rujukan.'
    if (form.next_control_date && form.next_control_date < hariIniWIB()) er.next_control_date = 'Jadwal kontrol tidak boleh sebelum hari ini.'
    setErrors(er)
    if (Object.keys(er).length) {
      setUmum('Ada isian yang perlu diperbaiki.')
      return
    }
    const data = {
      color_code: form.color_code,
      sbar_situation: form.sbar_situation.trim() || null,
      sbar_background: form.sbar_background.trim() || null,
      sbar_assessment: form.sbar_assessment.trim() || null,
      sbar_recommendation: form.sbar_recommendation.trim() || null,
      follow_up_instruction: form.follow_up_instruction.trim(),
      referral: form.referral,
      referral_to: form.referral ? form.referral_to.trim() : null,
      activity_recommendation: form.activity_recommendation.trim() || null,
      next_control_date: form.next_control_date || null,
      wound_care_schedule: form.wound_care_schedule.trim() || null,
    }
    setSimpan(true)
    const { error } = penilaian
      ? await supabase.from('assessments').update({ ...data, assessed_at: new Date().toISOString() }).eq('id', penilaian.id)
      : await supabase.from('assessments').insert({ ...data, foot_visit_id: kartu.id })
    setSimpan(false)
    if (error) return setUmum(pesanError(error))
    toast.sukses('Penilaian disimpan. Kader sudah diberi tahu.')
    onSaved?.()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={penilaian ? 'Ubah penilaian' : 'Beri penilaian'}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={simpan}>
            Batal
          </Button>
          <Button type="submit" form="form-penilaian" loading={simpan}>
            Simpan penilaian
          </Button>
        </>
      }
    >
      <form id="form-penilaian" onSubmit={onSubmit} noValidate className="space-y-6">
        <fieldset aria-describedby={errors.color_code ? 'kode-err' : undefined}>
          <legend className="text-lg font-extrabold">
            Kode warna <span className="text-danger" aria-hidden="true">*</span>
          </legend>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Object.entries(KODE_WARNA).map(([kode, k]) => {
              const Icon = k.icon
              const on = form.color_code === kode
              return (
                <label
                  key={kode}
                  className={`flex cursor-pointer flex-col gap-1 rounded-field border-2 p-4 transition-shadow has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary-soft ${k.cls} ${
                    on ? 'ring-4 ring-ink/70' : 'opacity-90'
                  }`}
                >
                  <input type="radio" name="kode" className="sr-only" checked={on} onChange={() => pilihKode(kode)} />
                  <span className="flex items-center gap-2 text-lg font-extrabold">
                    <Icon aria-hidden="true" className="size-6" />
                    {k.label}
                    {on && <span className="ml-auto text-base">✓ dipilih</span>}
                  </span>
                  <span className="font-bold">{k.judul}</span>
                  <span className="text-base">{PANDUAN_KODE[kode]}</span>
                </label>
              )
            })}
          </div>
          {errors.color_code && (
            <p id="kode-err" className="mt-2 font-semibold text-danger">
              {errors.color_code}
            </p>
          )}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-extrabold">SBAR</legend>
          <Textarea label="S — Situation (kondisi sekarang)" rows={2} hint="Contoh: luka telapak kiri kemerahan, bengkak." value={form.sbar_situation} onChange={set('sbar_situation')} />
          <Textarea label="B — Background (latar belakang)" rows={2} hint="Riwayat terkait, misalnya lama diabetes dan lama luka." value={form.sbar_background} onChange={set('sbar_background')} />
          <Textarea label="A — Assessment (penilaian perawat)" rows={2} hint="Contoh: curiga infeksi ringan." value={form.sbar_assessment} onChange={set('sbar_assessment')} />
          <Textarea label="R — Recommendation (rekomendasi)" rows={2} hint="Contoh: kontrol ke Pos Kaki hari Kamis." value={form.sbar_recommendation} onChange={set('sbar_recommendation')} />
        </fieldset>

        <Textarea
          label="Arahan tindak lanjut untuk kader/keluarga"
          required
          rows={3}
          hint="Ditampilkan di notifikasi kader dan di kartu cetak. Pakai bahasa sederhana."
          value={form.follow_up_instruction}
          onChange={set('follow_up_instruction')}
          error={errors.follow_up_instruction}
        />

        <div className={`rounded-field border-2 p-4 ${form.referral ? 'border-merah-line bg-danger-soft/40' : 'border-line'}`}>
          <label className="flex cursor-pointer items-center gap-3 font-extrabold">
            <input
              type="checkbox"
              checked={form.referral}
              onChange={(e) => setForm((f) => ({ ...f, referral: e.target.checked }))}
              className="size-6 accent-primary"
            />
            Rujuk ke Puskesmas/Rumah Sakit
          </label>
          {form.referral && (
            <TextInput
              className="mt-3"
              label="Tujuan rujukan"
              placeholder="Contoh: Puskesmas induk / RSUD"
              value={form.referral_to}
              onChange={set('referral_to')}
              error={errors.referral_to}
            />
          )}
          {form.color_code === 'merah' && (
            <p className="mt-2 text-base font-semibold text-danger">Kode merah: status pasien otomatis menjadi "Rujukan" jika dirujuk.</p>
          )}
        </div>

        <Textarea
          label="Rekomendasi aktivitas"
          rows={2}
          hint='Contoh: "boleh aktivitas ringan seperti senam lansia duduk, hindari beban pada kaki yang luka".'
          value={form.activity_recommendation}
          onChange={set('activity_recommendation')}
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextInput
            label="Jadwal kontrol berikutnya"
            type="date"
            min={hariIniWIB()}
            value={form.next_control_date}
            onChange={set('next_control_date')}
            error={errors.next_control_date}
          />
          <TextInput
            label="Jadwal perawatan luka"
            placeholder="Contoh: ganti balutan tiap 2 hari"
            value={form.wound_care_schedule}
            onChange={set('wound_care_schedule')}
          />
        </div>
        {umum && (
          <Banner tone="danger">
            <span role="alert">{umum}</span>
          </Banner>
        )}
      </form>
    </Modal>
  )
}
