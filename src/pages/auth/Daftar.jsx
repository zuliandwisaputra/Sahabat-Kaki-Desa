import { useState } from 'react'
import { Link } from 'react-router'
import { CircleCheck, MailCheck, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { pesanError } from '../../lib/errors'
import { REGISTER_ROLES } from '../../lib/permissions'
import { Button, ButtonLink } from '../../components/ui/Button'
import { PasswordInput, TextInput } from '../../components/ui/Field'
import { Banner } from '../../components/ui/misc'
import { AuthShell } from './AuthShell'

const USERNAME_RE = /^[a-z0-9._]{3,30}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// AUTH-02: nama lengkap, username, email, nomor HP, password, konfirmasi, peran
export default function Daftar() {
  const [form, setForm] = useState({
    full_name: '',
    username: '',
    email: '',
    phone: '',
    role: '',
    password: '',
    password2: '',
  })
  const [errors, setErrors] = useState({})
  const [umum, setUmum] = useState('')
  const [loading, setLoading] = useState(false)
  const [cekEmail, setCekEmail] = useState(false)

  const set = (k) => (e) => {
    const v = k === 'username' ? e.target.value.toLowerCase().replace(/\s/g, '') : e.target.value
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((er) => ({ ...er, [k]: undefined }))
  }

  async function cekUsername() {
    const u = form.username.trim()
    if (!USERNAME_RE.test(u)) return
    const { data } = await supabase.rpc('is_username_available', { p_username: u })
    if (data === false) setErrors((er) => ({ ...er, username: 'Username ini sudah dipakai. Coba yang lain.' }))
  }

  function validasi() {
    const e = {}
    if (form.full_name.trim().length < 3) e.full_name = 'Tulis nama lengkap (minimal 3 huruf).'
    if (!USERNAME_RE.test(form.username)) {
      e.username = 'Pakai 3–30 karakter: huruf kecil, angka, titik, atau garis bawah.'
    }
    if (!EMAIL_RE.test(form.email.trim())) e.email = 'Tulis alamat email yang benar, contoh: nama@gmail.com'
    if (!/^(\+62|62|0)8[0-9]{7,12}$/.test(form.phone.replace(/[\s-]/g, ''))) {
      e.phone = 'Tulis nomor HP yang benar, contoh: 081234567890'
    }
    if (!form.role) e.role = 'Pilih peran Anda.'
    if (form.password.length < 8) e.password = 'Password minimal 8 karakter.'
    if (form.password2 !== form.password) e.password2 = 'Konfirmasi password tidak sama.'
    return e
  }

  async function onSubmit(ev) {
    ev.preventDefault()
    setUmum('')
    const e = validasi()
    setErrors(e)
    if (Object.keys(e).length) {
      setUmum('Ada isian yang perlu diperbaiki. Lihat pesan merah di bawah kolom.')
      return
    }
    setLoading(true)
    try {
      const { data: tersedia } = await supabase.rpc('is_username_available', { p_username: form.username })
      if (tersedia === false) {
        setErrors({ username: 'Username ini sudah dipakai. Coba yang lain.' })
        setUmum('Username sudah dipakai.')
        return
      }
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: form.full_name.trim(),
            username: form.username.trim(),
            phone: form.phone.replace(/[\s-]/g, ''),
            role: form.role,
          },
        },
      })
      if (error) throw error
      // Jika konfirmasi email dimatikan di Supabase, pengguna langsung masuk.
      if (!data.session) setCekEmail(true)
    } catch (err) {
      setUmum(pesanError(err))
    } finally {
      setLoading(false)
    }
  }

  if (cekEmail) {
    return (
      <AuthShell title="Cek email Anda">
        <div className="flex flex-col items-center text-center">
          <span className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
            <MailCheck aria-hidden="true" className="size-8" />
          </span>
          <p className="mt-4 text-lg">
            Kami mengirim link konfirmasi ke <strong>{form.email}</strong>. Buka email tersebut lalu klik linknya
            untuk mengaktifkan akun.
          </p>
          <p className="mt-2 text-muted">Tidak ada di kotak masuk? Periksa folder Spam.</p>
          <ButtonLink to="/masuk" block className="mt-6">
            Kembali ke Masuk
          </ButtonLink>
        </div>
      </AuthShell>
    )
  }

  const peranDipilih = REGISTER_ROLES.find((r) => r.value === form.role)

  return (
    <AuthShell
      title="Daftar akun"
      subtitle="Isi data diri Anda. Semua kolom wajib diisi."
      footer={
        <>
          Sudah punya akun?{' '}
          <Link to="/masuk" className="font-bold text-primary underline underline-offset-4">
            Masuk
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <TextInput
          label="Nama lengkap"
          autoComplete="name"
          value={form.full_name}
          onChange={set('full_name')}
          error={errors.full_name}
          required
        />
        <TextInput
          label="Username"
          hint="Untuk masuk. Huruf kecil, angka, titik, atau garis bawah. Contoh: kader.ani"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={form.username}
          onChange={set('username')}
          onBlur={cekUsername}
          error={errors.username}
          required
        />
        <TextInput
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          value={form.email}
          onChange={set('email')}
          error={errors.email}
          required
        />
        <TextInput
          label="Nomor HP"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="08…"
          value={form.phone}
          onChange={set('phone')}
          error={errors.phone}
          required
        />

        <fieldset aria-describedby={errors.role ? 'peran-error' : undefined}>
          <legend className="font-bold">
            Peran <span className="text-danger" aria-hidden="true">*</span>
          </legend>
          <div className="mt-2 space-y-3">
            {REGISTER_ROLES.map((r) => {
              const dipilih = form.role === r.value
              return (
                <label
                  key={r.value}
                  className={`flex cursor-pointer gap-3 rounded-field border-2 p-4 transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary-soft ${
                    dipilih ? 'border-primary bg-primary-soft/40' : 'border-line bg-surface hover:bg-soft/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={dipilih}
                    onChange={set('role')}
                    className="mt-1 size-6 shrink-0 accent-primary"
                  />
                  <span>
                    <span className="block text-lg font-extrabold">{r.label}</span>
                    <span className="block text-muted">{r.desc}</span>
                  </span>
                </label>
              )
            })}
          </div>
          {errors.role && (
            <p id="peran-error" className="mt-2 font-semibold text-danger">
              {errors.role}
            </p>
          )}
        </fieldset>

        {peranDipilih?.needsApproval && (
          <Banner tone="info">
            Akun {peranDipilih.label} perlu disetujui Admin dulu. Sebelum disetujui, Anda hanya bisa melihat info umum.
          </Banner>
        )}
        {peranDipilih && !peranDipilih.needsApproval && (
          <Banner tone="success">
            Akun langsung aktif. Perawat atau Kader akan menghubungkan akun ini ke data pasien.
          </Banner>
        )}

        <PasswordInput
          label="Password"
          hint="Minimal 8 karakter."
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
          required
        />
        <PasswordInput
          label="Konfirmasi password"
          autoComplete="new-password"
          value={form.password2}
          onChange={set('password2')}
          error={errors.password2}
          required
        />

        {umum && (
          <Banner tone="danger">
            <span role="alert">{umum}</span>
          </Banner>
        )}
        <Button type="submit" block loading={loading} icon={UserPlus}>
          Daftar
        </Button>
        <p className="flex items-start gap-2 text-base text-muted">
          <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          Data Anda hanya dipakai untuk program perawatan kaki desa dan dilindungi sesuai UU Pelindungan Data
          Pribadi.
        </p>
      </form>
    </AuthShell>
  )
}
