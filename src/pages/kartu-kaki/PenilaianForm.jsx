import { useEffect, useMemo, useState } from 'react'
import { Lock } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { pesanError } from '../../lib/errors'
import { hariIniWIB } from '../../lib/format'
import { BWAT, PERINGKAT, RISIKO, skorBwat, warnaMinimal } from '../../lib/bwat'
import { useToast } from '../../context/ToastContext'
import { Button } from '../../components/ui/Button'
import { Select, TextInput, Textarea } from '../../components/ui/Field'
import { Modal } from '../../components/ui/Modal'
import { Banner, KODE_WARNA } from '../../components/ui/misc'
import { PilihanSatu } from '../../components/ui/extra'

const KOSONG = {
  has_wound: '',
  bwat_answers: {},
  color_code: '',
  override_reason: '',
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

/** Kotak hasil skor (selalu terlihat saat mengisi). */
export function HasilSkor({ adaLuka, skor, warna }) {
  if (adaLuka === '' || adaLuka === null || adaLuka === undefined) return null
  if (adaLuka && skor === null) {
    return <Banner tone="info">Isi ke-13 butir untuk melihat skor dan kode warna.</Banner>
  }
  const k = KODE_WARNA[warna]
  const r = RISIKO[warna]
  const Icon = k.icon
  return (
    <div className={`flex gap-3 rounded-field border-2 p-4 ${k.cls}`} role="status" aria-live="polite">
      <Icon aria-hidden="true" className="mt-0.5 size-7 shrink-0" />
      <div>
        <p className="text-lg font-extrabold">
          {adaLuka ? `Skor BWAT ${skor}` : 'Tidak ada luka terbuka'} → {k.label} · {r.risiko}
        </p>
        <p className="font-semibold">{r.keterangan}</p>
      </div>
    </div>
  )
}

// KKS-03/04/05: hanya perawat (dan admin) yang memberi kode warna dan SBAR.
// Kode warna mengikuti skor BWAT; perawat boleh menaikkan dengan alasan klinis.
export function PenilaianForm({ open, onClose, kartu, pasien, penilaian, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState(KOSONG)
  const [errors, setErrors] = useState({})
  const [umum, setUmum] = useState('')
  const [simpan, setSimpan] = useState(false)
  const [manual, setManual] = useState(false) // perawat memilih warna sendiri

  useEffect(() => {
    if (!open) return
    setManual(Boolean(penilaian && penilaian.score_color && penilaian.color_code !== penilaian.score_color))
    setErrors({})
    setUmum('')
    if (penilaian) {
      const f = { ...KOSONG }
      for (const k of Object.keys(KOSONG)) f[k] = penilaian[k] ?? KOSONG[k]
      f.has_wound = penilaian.has_wound === null || penilaian.has_wound === undefined ? '' : penilaian.has_wound
      f.bwat_answers = penilaian.bwat_answers ?? {}
      setForm(f)
    } else {
      const latar = [pasien?.diabetes_since_year && `DM sejak ${pasien.diabetes_since_year}`, pasien?.medical_history].filter(Boolean).join('. ')
      setForm({ ...KOSONG, sbar_background: latar })
    }
  }, [open, penilaian, pasien])

  const adaLuka = form.has_wound
  const skor = adaLuka === true ? skorBwat(form.bwat_answers) : null
  const minimal = useMemo(() => (adaLuka === '' ? null : warnaMinimal({ adaLuka, jawaban: form.bwat_answers })), [adaLuka, form.bwat_answers])

  // Warna otomatis naik mengikuti skor
  useEffect(() => {
    if (!minimal) return
    setForm((f) =>
      !manual || !f.color_code || PERINGKAT[f.color_code] < PERINGKAT[minimal]
        ? { ...f, color_code: minimal, referral: minimal === 'merah' ? true : f.referral }
        : f,
    )
  }, [minimal, manual])

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: undefined }))
  }
  const dinaikkan = minimal && form.color_code && form.color_code !== minimal

  async function onSubmit(e) {
    e.preventDefault()
    setUmum('')
    const er = {}
    if (form.has_wound === '') er.has_wound = 'Pilih apakah ada luka terbuka.'
    if (form.has_wound === true && skor === null) er.bwat = 'Isi ke-13 butir BWAT.'
    if (!form.color_code) er.color_code = 'Pilih kode warna.'
    if (dinaikkan && !form.override_reason.trim()) er.override_reason = 'Tulis alasan klinis menaikkan kode warna.'
    if (!form.follow_up_instruction.trim()) er.follow_up_instruction = 'Tulis arahan tindak lanjut untuk kader/keluarga.'
    if (form.referral && !form.referral_to.trim()) er.referral_to = 'Tulis tujuan rujukan.'
    if (form.next_control_date && form.next_control_date < hariIniWIB()) er.next_control_date = 'Jadwal kontrol tidak boleh sebelum hari ini.'
    setErrors(er)
    if (Object.keys(er).length) {
      setUmum('Ada isian yang perlu diperbaiki.')
      return
    }
    const data = {
      has_wound: form.has_wound,
      bwat_answers: form.has_wound ? form.bwat_answers : null,
      color_code: form.color_code,
      override_reason: dinaikkan ? form.override_reason.trim() : null,
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
        <section className="space-y-4">
          <h3 className="text-lg font-extrabold">1. Penilaian luka (BWAT)</h3>
          <PilihanSatu
            legend="Ada luka terbuka di kaki?"
            required
            options={{ ya: 'Ya, ada luka', tidak: 'Tidak ada luka' }}
            value={form.has_wound === true ? 'ya' : form.has_wound === false ? 'tidak' : ''}
            onChange={(v) => {
              setManual(false)
              setForm((f) => ({ ...f, has_wound: v === 'ya', color_code: '' }))
              setErrors((er) => ({ ...er, has_wound: undefined }))
            }}
            error={errors.has_wound}
          />
          {form.has_wound === true && (
            <div className="space-y-4 rounded-field border-2 border-line p-4">
              <p className="text-base text-muted">
                Bates-Jensen Wound Assessment Tool: 13 butir, masing-masing 1–5 poin. Total 13–65; makin tinggi makin berat.
              </p>
              {BWAT.map((b) => (
                <Select
                  key={b.key}
                  label={b.label}
                  value={form.bwat_answers[b.key] ?? ''}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : undefined
                    setForm((f) => ({ ...f, bwat_answers: { ...f.bwat_answers, [b.key]: v } }))
                    setErrors((er) => ({ ...er, bwat: undefined }))
                  }}
                >
                  <option value="">— pilih —</option>
                  {b.pilihan.map((teks, i) => (
                    <option key={i} value={i + 1}>
                      {i + 1} – {teks}
                    </option>
                  ))}
                </Select>
              ))}
              {errors.bwat && <p className="font-semibold text-danger">{errors.bwat}</p>}
            </div>
          )}
          <HasilSkor adaLuka={form.has_wound} skor={skor} warna={minimal} />
          <ul className="grid grid-cols-1 gap-1 text-base sm:grid-cols-3">
            {Object.entries(RISIKO).map(([w, r]) => (
              <li key={w} className="flex items-center gap-2">
                <span className={`rounded-lg border-2 px-2 font-extrabold ${KODE_WARNA[w].cls}`}>{KODE_WARNA[w].label}</span>
                {r.rentang} · {r.risiko}
              </li>
            ))}
          </ul>
        </section>

        <fieldset aria-describedby={errors.color_code ? 'kode-err' : undefined}>
          <legend className="text-lg font-extrabold">
            2. Kode warna <span className="text-danger" aria-hidden="true">*</span>
          </legend>
          <p className="text-base text-muted">
            Terpilih otomatis dari skor. Anda boleh menaikkan warna (misalnya ada demam atau tanda infeksi), tidak boleh menurunkan.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Object.entries(KODE_WARNA).map(([kode, k]) => {
              const Icon = k.icon
              const on = form.color_code === kode
              const terkunci = !minimal || PERINGKAT[kode] < PERINGKAT[minimal]
              return (
                <label
                  key={kode}
                  className={`flex flex-col gap-1 rounded-field border-2 p-4 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary-soft ${k.cls} ${
                    on ? 'ring-4 ring-ink/70' : ''
                  } ${terkunci ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                >
                  <input
                    type="radio"
                    name="kode"
                    className="sr-only"
                    checked={on}
                    disabled={terkunci}
                    onChange={() => {
                      setManual(kode !== minimal)
                      setForm((f) => ({ ...f, color_code: kode, referral: kode === 'merah' ? true : f.referral }))
                      setErrors((er) => ({ ...er, color_code: undefined }))
                    }}
                  />
                  <span className="flex items-center gap-2 text-lg font-extrabold">
                    <Icon aria-hidden="true" className="size-6" />
                    {k.label}
                    {on && <span className="ml-auto text-base">✓ dipilih</span>}
                    {terkunci && minimal && <Lock aria-label="Tidak bisa dipilih" className="ml-auto size-5" />}
                  </span>
                  <span className="font-bold">{RISIKO[kode].risiko}</span>
                  <span className="text-base">{k.arti}</span>
                </label>
              )
            })}
          </div>
          {errors.color_code && (
            <p id="kode-err" className="mt-2 font-semibold text-danger">
              {errors.color_code}
            </p>
          )}
          {dinaikkan && (
            <Textarea
              className="mt-4"
              label={`Alasan menaikkan dari ${KODE_WARNA[minimal].label} ke ${KODE_WARNA[form.color_code].label}`}
              required
              rows={2}
              hint="Contoh: demam, kemerahan meluas, gula darah sangat tinggi."
              value={form.override_reason}
              onChange={set('override_reason')}
              error={errors.override_reason}
            />
          )}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-lg font-extrabold">3. SBAR</legend>
          <Textarea label="S — Situation (kondisi sekarang)" rows={2} hint="Contoh: luka telapak kiri kemerahan, bengkak." value={form.sbar_situation} onChange={set('sbar_situation')} />
          <Textarea label="B — Background (latar belakang)" rows={2} hint="Riwayat terkait, misalnya lama diabetes dan lama luka." value={form.sbar_background} onChange={set('sbar_background')} />
          <Textarea label="A — Assessment (penilaian perawat)" rows={2} hint="Contoh: skor BWAT 32, curiga infeksi ringan." value={form.sbar_assessment} onChange={set('sbar_assessment')} />
          <Textarea label="R — Recommendation (rekomendasi)" rows={2} hint="Contoh: kontrol ke Pos Kaki hari Kamis." value={form.sbar_recommendation} onChange={set('sbar_recommendation')} />
        </fieldset>

        <section className="space-y-5">
          <h3 className="text-lg font-extrabold">4. Arahan & jadwal</h3>
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
              <input type="checkbox" checked={form.referral} onChange={(e) => setForm((f) => ({ ...f, referral: e.target.checked }))} className="size-6 accent-primary" />
              Rujuk ke Puskesmas/Rumah Sakit
            </label>
            {form.referral && (
              <TextInput className="mt-3" label="Tujuan rujukan" placeholder="Contoh: Puskesmas induk / RSUD" value={form.referral_to} onChange={set('referral_to')} error={errors.referral_to} />
            )}
            {form.color_code === 'merah' && <p className="mt-2 text-base font-semibold text-danger">Kode merah: status pasien otomatis menjadi "Rujukan" jika dirujuk.</p>}
          </div>
          <Textarea
            label="Rekomendasi aktivitas"
            rows={2}
            hint='Contoh: "boleh aktivitas ringan seperti senam lansia duduk, hindari beban pada kaki yang luka".'
            value={form.activity_recommendation}
            onChange={set('activity_recommendation')}
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextInput label="Jadwal kontrol berikutnya" type="date" min={hariIniWIB()} value={form.next_control_date} onChange={set('next_control_date')} error={errors.next_control_date} />
            <TextInput label="Jadwal perawatan luka" placeholder="Contoh: ganti balutan tiap 2 hari" value={form.wound_care_schedule} onChange={set('wound_care_schedule')} />
          </div>
        </section>
        {umum && (
          <Banner tone="danger">
            <span role="alert">{umum}</span>
          </Banner>
        )}
      </form>
    </Modal>
  )
}
