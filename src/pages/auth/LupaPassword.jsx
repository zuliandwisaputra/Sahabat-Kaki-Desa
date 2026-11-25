import { useState } from 'react'
import { Link } from 'react-router'
import { MailCheck, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { pesanError } from '../../lib/errors'
import { Button, ButtonLink } from '../../components/ui/Button'
import { TextInput } from '../../components/ui/Field'
import { Banner } from '../../components/ui/misc'
import { AuthShell } from './AuthShell'

// AUTH-05: lupa password lewat link reset ke email
export default function LupaPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [terkirim, setTerkirim] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    const alamat = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alamat)) {
      setError('Tulis alamat email yang benar, contoh: nama@gmail.com')
      return
    }
    setLoading(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(alamat, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (err) setError(pesanError(err))
    else setTerkirim(true)
  }

  if (terkirim) {
    return (
      <AuthShell title="Cek email Anda">
        <div className="flex flex-col items-center text-center">
          <span className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
            <MailCheck aria-hidden="true" className="size-8" />
          </span>
          <p className="mt-4 text-lg">
            Jika <strong>{email}</strong> terdaftar, link untuk membuat password baru sudah dikirim.
          </p>
          <p className="mt-2 text-muted">Tidak ada di kotak masuk? Periksa folder Spam.</p>
          <ButtonLink to="/masuk" block className="mt-6">
            Kembali ke Masuk
          </ButtonLink>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Lupa password"
      subtitle="Tulis email akun Anda. Kami kirim link untuk membuat password baru."
      footer={
        <Link to="/masuk" className="font-bold text-primary underline underline-offset-4">
          Kembali ke Masuk
        </Link>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <TextInput
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {error && (
          <Banner tone="danger">
            <span role="alert">{error}</span>
          </Banner>
        )}
        <Button type="submit" block loading={loading} icon={Send}>
          Kirim link
        </Button>
      </form>
    </AuthShell>
  )
}
