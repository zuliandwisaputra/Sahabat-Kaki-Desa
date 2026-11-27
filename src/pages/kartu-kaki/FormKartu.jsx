import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { Save, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { pesanError } from '../../lib/errors'
import { unggahFoto } from '../../lib/storage'
import { hariIniWIB } from '../../lib/format'
import { PERUBAHAN, TANDA } from '../../lib/pasien'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useCan } from '../../components/Can'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Select, TextInput, Textarea } from '../../components/ui/Field'
import { Banner, Card, EmptyState, PageHeader, Spinner } from '../../components/ui/misc'
import { GambarPrivat, PilihanCentang, PilihanSatu, PilihFoto } from '../../components/ui/extra'

// KKS-02: kader mencatat pengamatan saat kunjungan (tanpa kode warna — KKS-05)
export default function FormKartu() {
  const { id } = useParams()
  const ubah = Boolean(id)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { profile } = useAuth()
  const boleh = useCan('kartu.catat')
  const petugasPenuh = ['perawat', 'admin'].includes(profile.role)

  const [pasienList, setPasienList] = useState([])
  const [kondisiList, setKondisiList] = useState([])
  const [dampingan, setDampingan] = useState(new Set())
  const [asli, setAsli] = useState(null)
  const [memuat, setMemuat] = useState(true)
  const [form, setForm] = useState({
    patient_id: params.get('pasien') ?? '',
    visit_date: hariIniWIB(),
    reported_change: '',
    signs: [],
    foot_condition: '',
    observation_notes: '',
  })
  const [foto, setFoto] = useState(null)
  const [errors, setErrors] = useState({})
  const [umum, setUmum] = useState('')
  const [simpan, setSimpan] = useState(null) // 'draft' | 'dikirim'

  useEffect(() => {
    if (!boleh) return
    ;(async () => {
      const [pasien, kondisi, pend, kartu] = await Promise.all([
        supabase.from('patients').select('id, full_name, rt').is('archived_at', null).order('full_name'),
        supabase.from('master_options').select('value').eq('category', 'kondisi_kaki').eq('active', true).order('sort_order'),
        supabase.from('companions').select('patient_id').eq('active', true).eq('profile_id', profile.id),
        ubah ? supabase.from('foot_visits').select('*').eq('id', id).maybeSingle() : Promise.resolve({ data: null }),
      ])
      setPasienList(pasien.data ?? [])
      setKondisiList((kondisi.data ?? []).map((k) => k.value))
      setDampingan(new Set((pend.data ?? []).map((c) => c.patient_id)))
      if (kartu.data) {
        const k = kartu.data
        setAsli(k)
        setForm({
          patient_id: k.patient_id,
          visit_date: k.visit_date,
          reported_change: k.reported_change ?? '',
          signs: k.signs ?? [],
          foot_condition: k.foot_condition ?? '',
          observation_notes: k.observation_notes ?? '',
        })
      }
      setMemuat(false)
    })()
  }, [boleh, ubah, id, profile.id])

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: undefined }))
  }

  async function kirim(status) {
    setUmum('')
    const e = {}
    if (!form.patient_id) e.patient_id = 'Pilih pasien.'
    if (!form.visit_date) e.visit_date = 'Isi tanggal kunjungan.'
    else if (form.visit_date > hariIniWIB()) e.visit_date = 'Tanggal tidak boleh setelah hari ini.'
    if (!form.reported_change) e.reported_change = 'Pilih perubahan menurut laporan pasien/keluarga.'
    setErrors(e)
    if (Object.keys(e).length) {
      setUmum('Ada isian yang perlu diperbaiki.')
      return
    }
    setSimpan(status)
    try {
      let photo_path = asli?.photo_path ?? null
      if (foto) photo_path = await unggahFoto('wound-photos', `${form.patient_id}/kunjungan`, foto)
      const data = {
        patient_id: form.patient_id,
        visit_date: form.visit_date,
        reported_change: form.reported_change,
        signs: form.signs,
        foot_condition: form.foot_condition || null,
        observation_notes: form.observation_notes.trim() || null,
        photo_path,
        // Kartu yang sudah dinilai (diubah perawat/admin) tetap pada statusnya
        status: ubah && ['dinilai', 'ditindaklanjuti'].includes(asli.status) ? asli.status : status,
      }
      let kartuId = id
      if (ubah) {
        const { error } = await supabase.from('foot_visits').update(data).eq('id', id)
        if (error) throw error
        if (foto && asli?.photo_path) await supabase.storage.from('wound-photos').remove([asli.photo_path])
      } else {
        const { data: baru, error } = await supabase.from('foot_visits').insert(data).select('id').single()
        if (error) throw error
        kartuId = baru.id
      }
      toast.sukses(status === 'dikirim' ? 'Kartu dikirim. Perawat sudah diberi tahu.' : 'Draft disimpan.')
      navigate(`/kartu-kaki/${kartuId}`, { replace: true })
    } catch (err) {
      setUmum(pesanError(err))
    } finally {
      setSimpan(null)
    }
  }

  if (!boleh) {
    return (
      <EmptyState title="Anda tidak punya izin untuk mengisi kartu" action={<ButtonLink to="/kartu-kaki">Kembali</ButtonLink>}>
        Kartu Kaki Sehat diisi oleh Kader, Perawat, atau Admin yang sudah disetujui.
      </EmptyState>
    )
  }
  if (memuat) return <Spinner />
  if (ubah && !asli) return <EmptyState title="Kartu tidak ditemukan" />
  if (ubah && !petugasPenuh && !['draft', 'dikirim'].includes(asli.status)) {
    return (
      <EmptyState title="Kartu sudah dinilai perawat" action={<ButtonLink to={`/kartu-kaki/${id}`}>Lihat kartu</ButtonLink>}>
        Catatan kader tidak bisa diubah lagi setelah perawat memberi penilaian.
      </EmptyState>
    )
  }

  const milikku = pasienList.filter((p) => dampingan.has(p.id))
  const lainnya = pasienList.filter((p) => !dampingan.has(p.id))

  return (
    <div>
      <PageHeader
        title={ubah ? 'Ubah catatan kartu' : 'Isi Kartu Kaki Sehat'}
        description="Catat yang Anda lihat dan dengar saat kunjungan. Kode warna diberikan oleh perawat."
      />
      <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-5">
        <Card className="space-y-5">
          <Select label="Pasien" value={form.patient_id} onChange={set('patient_id')} error={errors.patient_id} required disabled={ubah}>
            <option value="">— pilih pasien —</option>
            {milikku.length > 0 && (
              <optgroup label="Dampingan saya">
                {milikku.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name} · RT {p.rt}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={milikku.length ? 'Pasien lain' : 'Semua pasien'}>
              {lainnya.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} · RT {p.rt}
                </option>
              ))}
            </optgroup>
          </Select>
          <TextInput
            label="Tanggal kunjungan"
            type="date"
            max={hariIniWIB()}
            value={form.visit_date}
            onChange={set('visit_date')}
            error={errors.visit_date}
            required
          />
        </Card>

        <Card className="space-y-5">
          <h2 className="text-xl font-extrabold">Pengamatan</h2>
          <PilihanSatu
            legend="Perubahan menurut laporan pasien/keluarga"
            required
            options={PERUBAHAN}
            value={form.reported_change}
            onChange={(v) => {
              setForm((f) => ({ ...f, reported_change: v }))
              setErrors((er) => ({ ...er, reported_change: undefined }))
            }}
            error={errors.reported_change}
          />
          <PilihanCentang
            legend="Tanda atau keluhan yang diamati"
            hint="Pilih semua yang ada. Kosongkan jika tidak ada."
            options={TANDA}
            value={form.signs}
            onChange={(v) => setForm((f) => ({ ...f, signs: v }))}
          />
          {kondisiList.length > 0 && (
            <Select label="Kondisi kaki" value={form.foot_condition} onChange={set('foot_condition')}>
              <option value="">— pilih —</option>
              {kondisiList.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Select>
          )}
          <Textarea
            label="Catatan pengamatan"
            hint="Contoh: luka di telapak kiri tampak lebih merah, pasien mengeluh nyeri saat berjalan."
            rows={4}
            value={form.observation_notes}
            onChange={set('observation_notes')}
          />
          <div>
            {asli?.photo_path && !foto && (
              <GambarPrivat bucket="wound-photos" path={asli.photo_path} alt="Foto luka sebelumnya" className="mb-3 h-40 w-auto" />
            )}
            <PilihFoto
              label="Foto luka (opsional)"
              file={foto}
              onChange={setFoto}
              hint="Foto disimpan privat dan dikompres otomatis. Hanya petugas kesehatan dan pasien ybs yang bisa melihat."
            />
          </div>
        </Card>

        {form.signs.length > 0 && form.reported_change === 'memburuk' && (
          <Banner tone="warning" title="Kondisi memburuk">
            Kirim kartu ini ke perawat sekarang supaya segera dinilai.
          </Banner>
        )}
        {umum && (
          <Banner tone="danger">
            <span role="alert">{umum}</span>
          </Banner>
        )}
        <div className="flex flex-wrap gap-3">
          <Button icon={Send} loading={simpan === 'dikirim'} disabled={Boolean(simpan)} onClick={() => kirim('dikirim')}>
            Kirim ke perawat
          </Button>
          {(!ubah || asli?.status === 'draft') && (
            <Button variant="secondary" icon={Save} loading={simpan === 'draft'} disabled={Boolean(simpan)} onClick={() => kirim('draft')}>
              Simpan draft
            </Button>
          )}
          <ButtonLink to={ubah ? `/kartu-kaki/${id}` : '/kartu-kaki'} variant="quiet">
            Batal
          </ButtonLink>
        </div>
      </form>
    </div>
  )
}
