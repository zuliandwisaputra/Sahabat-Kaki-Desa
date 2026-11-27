import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Save } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { pesanError } from '../../lib/errors'
import { unggahFoto } from '../../lib/storage'
import { HAMBATAN, STATUS_PASIEN } from '../../lib/pasien'
import { hariIniWIB, formatTanggal } from '../../lib/format'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useCan } from '../../components/Can'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Select, TextInput, Textarea } from '../../components/ui/Field'
import { Banner, Card, EmptyState, PageHeader, Spinner } from '../../components/ui/misc'
import { GambarPrivat, PilihanCentang, PilihanSatu, PilihFoto } from '../../components/ui/extra'

const KOSONG = {
  full_name: '',
  nik: '',
  birth_date: '',
  gender: '',
  dusun: '',
  rt: '',
  rw: '',
  address_detail: '',
  phone: '',
  family_name: '',
  family_relation: '',
  family_phone: '',
  diabetes_since_year: '',
  medical_history: '',
  barriers: [],
  barrier_notes: '',
  consent_program: false,
  consent_share: false,
  status: 'aktif',
}

const TEKS = [
  'full_name', 'nik', 'dusun', 'rt', 'rw', 'address_detail', 'phone',
  'family_name', 'family_relation', 'family_phone', 'medical_history', 'barrier_notes',
]

function bersihkan(form) {
  const out = { ...form }
  for (const k of TEKS) out[k] = String(out[k] ?? '').trim() || null
  out.full_name = out.full_name ?? ''
  out.diabetes_since_year = form.diabetes_since_year ? Number(form.diabetes_since_year) : null
  out.birth_date = form.birth_date || null
  out.phone = out.phone?.replace(/[\s-]/g, '') ?? null
  out.family_phone = out.family_phone?.replace(/[\s-]/g, '') ?? null
  return out
}

// PAS-02 (identitas), PAS-04 (tolak pasien ganda), PAS-05 (pasien isi identitas sendiri), PAS-06 (persetujuan)
export default function FormPasien() {
  const { id } = useParams()
  const ubah = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()
  const { profile } = useAuth()
  const bolehPetugas = useCan(ubah ? 'pasien.ubah' : 'pasien.tambah')
  const pasienSendiri = profile.role === 'pasien' && profile.patient_id === id && profile.approval_status === 'disetujui'
  const boleh = bolehPetugas || pasienSendiri

  const [form, setForm] = useState(KOSONG)
  const [asli, setAsli] = useState(null)
  const [foto, setFoto] = useState(null)
  const [errors, setErrors] = useState({})
  const [umum, setUmum] = useState('')
  const [ganda, setGanda] = useState(null)
  const [memuat, setMemuat] = useState(ubah)
  const [simpan, setSimpan] = useState(false)
  const [dusunList, setDusunList] = useState([])

  useEffect(() => {
    supabase
      .from('master_options')
      .select('value')
      .eq('category', 'dusun')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => setDusunList((data ?? []).map((d) => d.value)))
  }, [])

  useEffect(() => {
    if (!ubah) return
    supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setAsli(data)
          const f = { ...KOSONG }
          for (const k of Object.keys(KOSONG)) f[k] = data[k] ?? KOSONG[k]
          f.diabetes_since_year = data.diabetes_since_year ? String(data.diabetes_since_year) : ''
          setForm(f)
        }
        setMemuat(false)
      })
  }, [id, ubah])

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrors((er) => ({ ...er, [k]: undefined }))
  }

  function validasi() {
    const e = {}
    if (form.full_name.trim().length < 2) e.full_name = 'Tulis nama pasien.'
    if (form.nik && !/^[0-9]{16}$/.test(form.nik.trim())) e.nik = 'NIK harus 16 angka (boleh dikosongkan).'
    if (!form.birth_date) e.birth_date = 'Isi tanggal lahir (perkiraan boleh).'
    else if (form.birth_date > hariIniWIB()) e.birth_date = 'Tanggal lahir tidak boleh setelah hari ini.'
    if (!form.gender) e.gender = 'Pilih jenis kelamin.'
    if (!form.dusun.trim()) e.dusun = 'Isi nama dusun.'
    if (!form.rt.trim()) e.rt = 'Isi RT.'
    const th = Number(form.diabetes_since_year)
    if (form.diabetes_since_year && (th < 1950 || th > Number(hariIniWIB().slice(0, 4)))) {
      e.diabetes_since_year = 'Tulis tahun yang benar, contoh: 2014'
    }
    if (!ubah && !form.consent_program) {
      e.consent_program = 'Pasien dan keluarga harus setuju ikut program sebelum didaftarkan.'
    }
    return e
  }

  async function cariGanda(data) {
    const { data: rows } = await supabase
      .from('patients')
      .select('id, full_name, dusun, rt')
      .ilike('full_name', data.full_name)
      .eq('birth_date', data.birth_date)
      .ilike('dusun', data.dusun)
      .eq('rt', data.rt)
      .limit(1)
    return rows?.[0] ?? null
  }

  async function onSubmit(ev) {
    ev.preventDefault()
    setUmum('')
    setGanda(null)
    const e = validasi()
    setErrors(e)
    if (Object.keys(e).length) {
      setUmum('Ada isian yang perlu diperbaiki. Lihat pesan merah di bawah kolom.')
      return
    }
    setSimpan(true)
    try {
      const data = bersihkan(form)
      if (!bolehPetugas) delete data.status // Pasien/Keluarga tidak mengubah status
      let pasienId = id

      if (!ubah) {
        const sama = await cariGanda(data)
        if (sama) {
          setGanda(sama)
          return
        }
        const { data: baru, error } = await supabase.from('patients').insert(data).select('id').single()
        if (error) {
          if (error.code === '23505') {
            setGanda(await cariGanda(data))
            return
          }
          throw error
        }
        pasienId = baru.id
      } else {
        const { error } = await supabase.from('patients').update(data).eq('id', id)
        if (error) {
          if (error.code === '23505') throw new Error('Sudah ada pasien lain dengan nama, tanggal lahir, dan alamat yang sama.')
          throw error
        }
      }

      if (foto) {
        try {
          const path = await unggahFoto('wound-photos', `${pasienId}/profil`, foto)
          await supabase.from('patients').update({ photo_path: path }).eq('id', pasienId)
        } catch (err) {
          toast.gagal(`Data tersimpan, tetapi foto gagal diunggah: ${pesanError(err)}`)
        }
      }
      toast.sukses(ubah ? 'Data pasien disimpan.' : 'Pasien berhasil didaftarkan.')
      navigate(`/pasien/${pasienId}`, { replace: true })
    } catch (err) {
      setUmum(pesanError(err))
    } finally {
      setSimpan(false)
    }
  }

  if (!boleh) {
    return (
      <EmptyState title="Anda tidak punya izin untuk halaman ini" action={<ButtonLink to="/pasien">Kembali ke daftar pasien</ButtonLink>}>
        Menambah dan mengubah data pasien hanya untuk Perawat, Kader, dan Admin yang sudah disetujui.
      </EmptyState>
    )
  }
  if (memuat) return <Spinner />
  if (ubah && !asli) return <EmptyState title="Data pasien tidak ditemukan" />

  return (
    <div>
      <PageHeader
        title={ubah ? `Ubah data ${asli.full_name}` : 'Tambah pasien'}
        description={pasienSendiri ? 'Anda bisa mengisi atau mengoreksi identitas pasien yang terhubung ke akun Anda.' : 'Kolom bertanda * wajib diisi.'}
      />
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <Card className="space-y-5">
          <h2 className="text-xl font-extrabold">Identitas</h2>
          <TextInput label="Nama lengkap" value={form.full_name} onChange={set('full_name')} error={errors.full_name} required />
          <TextInput
            label="NIK"
            hint="Opsional. 16 angka sesuai KTP."
            inputMode="numeric"
            maxLength={16}
            value={form.nik}
            onChange={set('nik')}
            error={errors.nik}
          />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextInput
              label="Tanggal lahir"
              type="date"
              max={hariIniWIB()}
              value={form.birth_date}
              onChange={set('birth_date')}
              error={errors.birth_date}
              required
            />
            <PilihanSatu
              legend="Jenis kelamin"
              required
              options={{ P: 'Perempuan', L: 'Laki-laki' }}
              value={form.gender}
              onChange={(v) => setForm((f) => ({ ...f, gender: v }))}
              error={errors.gender}
            />
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <TextInput label="Dusun" list="daftar-dusun" value={form.dusun} onChange={set('dusun')} error={errors.dusun} required />
            <datalist id="daftar-dusun">
              {dusunList.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
            <TextInput label="RT" inputMode="numeric" value={form.rt} onChange={set('rt')} error={errors.rt} required />
            <TextInput label="RW" inputMode="numeric" value={form.rw} onChange={set('rw')} />
          </div>
          <TextInput label="Alamat lengkap" hint="Nama jalan/gang, patokan rumah." value={form.address_detail} onChange={set('address_detail')} />
          <TextInput label="Nomor HP pasien" type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} />
        </Card>

        <Card className="space-y-5">
          <h2 className="text-xl font-extrabold">Keluarga pendamping</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <TextInput label="Nama keluarga" value={form.family_name} onChange={set('family_name')} />
            <TextInput label="Hubungan" placeholder="Suami, anak, …" value={form.family_relation} onChange={set('family_relation')} />
          </div>
          <TextInput label="Nomor HP keluarga" type="tel" inputMode="tel" value={form.family_phone} onChange={set('family_phone')} />
        </Card>

        <Card className="space-y-5">
          <h2 className="text-xl font-extrabold">Riwayat & hambatan</h2>
          <TextInput
            label="Diabetes sejak tahun"
            inputMode="numeric"
            maxLength={4}
            placeholder="Contoh: 2014"
            value={form.diabetes_since_year}
            onChange={set('diabetes_since_year')}
            error={errors.diabetes_since_year}
          />
          <Textarea
            label="Riwayat penyakit"
            hint="Contoh: DM tipe 2, luka di telapak kaki kiri sejak 3 bulan."
            rows={3}
            value={form.medical_history}
            onChange={set('medical_history')}
          />
          <PilihanCentang
            legend="Hambatan utama"
            hint="Boleh pilih lebih dari satu."
            options={HAMBATAN}
            value={form.barriers}
            onChange={(v) => setForm((f) => ({ ...f, barriers: v }))}
          />
          <Textarea label="Keterangan hambatan" rows={2} value={form.barrier_notes} onChange={set('barrier_notes')} />
          <div>
            {asli?.photo_path && !foto && (
              <GambarPrivat bucket="wound-photos" path={asli.photo_path} alt={`Foto ${asli.full_name}`} className="mb-3 size-28" />
            )}
            <PilihFoto label="Foto pasien (opsional)" file={foto} onChange={setFoto} hint="Foto dikompres otomatis sebelum diunggah." />
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="text-xl font-extrabold">Persetujuan pasien & keluarga</h2>
          <label className="flex cursor-pointer gap-3">
            <input
              type="checkbox"
              checked={form.consent_program}
              onChange={(e) => {
                setForm((f) => ({ ...f, consent_program: e.target.checked }))
                setErrors((er) => ({ ...er, consent_program: undefined }))
              }}
              className="mt-1 size-6 shrink-0 accent-primary"
            />
            <span>
              <span className="block font-bold">Setuju ikut program Sahabat Kaki Desa {!ubah && <span className="text-danger">*</span>}</span>
              <span className="block text-muted">
                {asli?.consent_program_date ? `Disetujui ${formatTanggal(asli.consent_program_date)}` : 'Tanggal tercatat otomatis saat disimpan.'}
              </span>
            </span>
          </label>
          {errors.consent_program && <p className="font-semibold text-danger">{errors.consent_program}</p>}
          <label className="flex cursor-pointer gap-3">
            <input
              type="checkbox"
              checked={form.consent_share}
              onChange={(e) => setForm((f) => ({ ...f, consent_share: e.target.checked }))}
              className="mt-1 size-6 shrink-0 accent-primary"
            />
            <span>
              <span className="block font-bold">Setuju kondisinya dibagikan ke pendamping dan grup koordinasi Siaga Kaki</span>
              <span className="block text-muted">
                {asli?.consent_share_date ? `Disetujui ${formatTanggal(asli.consent_share_date)}` : 'Diperlukan sebelum pasien dipasangkan dengan pendamping.'}
              </span>
            </span>
          </label>
        </Card>

        {ubah && bolehPetugas && (
          <Card className="space-y-4">
            <h2 className="text-xl font-extrabold">Status pasien</h2>
            <Select label="Status" value={form.status} onChange={set('status')}>
              {Object.entries(STATUS_PASIEN).map(([v, s]) => (
                <option key={v} value={v}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Card>
        )}

        {ganda && (
          <Banner tone="warning" title="Pasien ini sepertinya sudah terdaftar">
            Sudah ada <strong>{ganda.full_name}</strong> dengan tanggal lahir dan alamat (Dusun {ganda.dusun}, RT {ganda.rt})
            yang sama.{' '}
            <Link to={`/pasien/${ganda.id}`} className="font-bold underline underline-offset-4">
              Buka data yang sudah ada
            </Link>
          </Banner>
        )}
        {umum && (
          <Banner tone="danger">
            <span role="alert">{umum}</span>
          </Banner>
        )}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" icon={Save} loading={simpan}>
            {ubah ? 'Simpan perubahan' : 'Daftarkan pasien'}
          </Button>
          <ButtonLink to={ubah ? `/pasien/${id}` : '/pasien'} variant="secondary">
            Batal
          </ButtonLink>
        </div>
      </form>
    </div>
  )
}
