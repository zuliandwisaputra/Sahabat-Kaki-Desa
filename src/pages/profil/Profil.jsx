import { useEffect, useRef, useState } from 'react'
import { Camera, KeyRound, LogOut, Save } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { pesanError } from '../../lib/errors'
import { unggahFoto } from '../../lib/storage'
import { ROLE_LABELS } from '../../lib/permissions'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { PasswordInput, TextInput } from '../../components/ui/Field'
import { Badge, Card, PageHeader } from '../../components/ui/misc'

const STATUS = {
  menunggu: { tone: 'warning', text: 'Menunggu persetujuan' },
  disetujui: { tone: 'success', text: 'Aktif' },
  ditolak: { tone: 'danger', text: 'Tidak disetujui' },
}

// AUTH-06: ganti foto profil, nama, nomor HP, dan password
export default function Profil() {
  const { profile, user, refreshProfile, signOut } = useAuth()
  const toast = useToast()
  const fileRef = useRef(null)
  const [form, setForm] = useState({ full_name: '', phone: '', dusun: '', rt: '' })
  const [errors, setErrors] = useState({})
  const [simpan, setSimpan] = useState(false)
  const [unggah, setUnggah] = useState(false)
  const [pw, setPw] = useState({ baru: '', ulang: '' })
  const [pwError, setPwError] = useState('')
  const [simpanPw, setSimpanPw] = useState(false)

  useEffect(() => {
    setForm({
      full_name: profile.full_name ?? '',
      phone: profile.phone ?? '',
      dusun: profile.dusun ?? '',
      rt: profile.rt ?? '',
    })
  }, [profile])

  async function gantiFoto(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUnggah(true)
    try {
      const lama = profile.avatar_path
      const path = await unggahFoto('avatars', profile.id, file)
      const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', profile.id)
      if (error) throw error
      if (lama) await supabase.storage.from('avatars').remove([lama])
      await refreshProfile()
      toast.sukses('Foto profil diganti.')
    } catch (err) {
      toast.gagal(pesanError(err))
    } finally {
      setUnggah(false)
    }
  }

  async function simpanProfil(e) {
    e.preventDefault()
    const er = {}
    if (form.full_name.trim().length < 3) er.full_name = 'Tulis nama lengkap (minimal 3 huruf).'
    if (form.phone && !/^(\+62|62|0)8[0-9]{7,12}$/.test(form.phone.replace(/[\s-]/g, ''))) {
      er.phone = 'Tulis nomor HP yang benar, contoh: 081234567890'
    }
    setErrors(er)
    if (Object.keys(er).length) return
    setSimpan(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name.trim(),
        phone: form.phone.replace(/[\s-]/g, '') || null,
        dusun: form.dusun.trim() || null,
        rt: form.rt.trim() || null,
      })
      .eq('id', profile.id)
    setSimpan(false)
    if (error) return toast.gagal(pesanError(error))
    await refreshProfile()
    toast.sukses('Profil disimpan.')
  }

  async function gantiPassword(e) {
    e.preventDefault()
    setPwError('')
    if (pw.baru.length < 8) return setPwError('Password minimal 8 karakter.')
    if (pw.baru !== pw.ulang) return setPwError('Konfirmasi password tidak sama.')
    setSimpanPw(true)
    const { error } = await supabase.auth.updateUser({ password: pw.baru })
    setSimpanPw(false)
    if (error) return setPwError(pesanError(error))
    setPw({ baru: '', ulang: '' })
    toast.sukses('Password diganti.')
  }

  const status = STATUS[profile.approval_status]

  return (
    <div className="space-y-5">
      <PageHeader title="Profil saya" />

      <Card className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <div className="relative">
          <Avatar name={profile.full_name} path={profile.avatar_path} size="lg" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={unggah}
            aria-label="Ganti foto profil"
            className="absolute -right-3 -bottom-2 grid size-12 place-items-center rounded-full border-4 border-surface bg-primary text-white shadow-button disabled:opacity-60"
          >
            <Camera aria-hidden="true" className="size-5" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={gantiFoto} tabIndex={-1} />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-extrabold">{profile.full_name}</p>
          <p className="text-muted">
            @{profile.username} · {user?.email}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Badge tone="primary">{ROLE_LABELS[profile.role]}</Badge>
            <Badge tone={status.tone}>{status.text}</Badge>
          </div>
          {unggah && <p className="mt-2 font-semibold text-muted">Mengunggah foto…</p>}
        </div>
      </Card>

      <Card as="form" onSubmit={simpanProfil} noValidate className="space-y-5">
        <h2 className="text-xl font-extrabold">Data diri</h2>
        <TextInput
          label="Nama lengkap"
          autoComplete="name"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          error={errors.full_name}
          required
        />
        <TextInput
          label="Nomor HP"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          error={errors.phone}
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <TextInput label="Dusun" value={form.dusun} onChange={(e) => setForm({ ...form, dusun: e.target.value })} />
          <TextInput
            label="RT"
            inputMode="numeric"
            value={form.rt}
            onChange={(e) => setForm({ ...form, rt: e.target.value })}
          />
        </div>
        <p className="text-base text-muted">Username dan email tidak bisa diubah di sini.</p>
        <Button type="submit" icon={Save} loading={simpan}>
          Simpan data diri
        </Button>
      </Card>

      <Card as="form" onSubmit={gantiPassword} noValidate className="space-y-5">
        <h2 className="text-xl font-extrabold">Ganti password</h2>
        <PasswordInput
          label="Password baru"
          hint="Minimal 8 karakter."
          autoComplete="new-password"
          value={pw.baru}
          onChange={(e) => setPw({ ...pw, baru: e.target.value })}
        />
        <PasswordInput
          label="Konfirmasi password baru"
          autoComplete="new-password"
          value={pw.ulang}
          onChange={(e) => setPw({ ...pw, ulang: e.target.value })}
          error={pwError}
        />
        <Button type="submit" variant="secondary" icon={KeyRound} loading={simpanPw}>
          Ganti password
        </Button>
      </Card>

      <Button variant="secondary" icon={LogOut} block onClick={signOut} className="lg:hidden">
        Keluar
      </Button>
    </div>
  )
}
