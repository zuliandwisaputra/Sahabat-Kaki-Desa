import { useState } from 'react'
import { useNavigate } from 'react-router'
import { KeyRound } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { pesanError } from '../../lib/errors'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { SplashScreen } from '../../components/RequireAuth'
import { Button, ButtonLink } from '../../components/ui/Button'
import { PasswordInput } from '../../components/ui/Field'
import { Banner } from '../../components/ui/misc'
import { AuthShell } from './AuthShell'

// Halaman tujuan link dari email "Lupa password"
export default function ResetPassword() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [simpan, setSimpan] = useState(false)

  if (loading) return <SplashScreen />

  if (!session) {
    return (
      <AuthShell title="Link tidak berlaku">
        <p className="text-lg">Link untuk membuat password baru sudah kedaluwarsa atau sudah dipakai.</p>
        <ButtonLink to="/lupa-password" block className="mt-6">
          Minta link baru
        </ButtonLink>
      </AuthShell>
    )
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    if (pw.length < 8) return setError('Password minimal 8 karakter.')
    if (pw !== pw2) return setError('Konfirmasi password tidak sama.')
    setSimpan(true)
    const { error: err } = await supabase.auth.updateUser({ password: pw })
    setSimpan(false)
    if (err) return setError(pesanError(err))
    toast.sukses('Password baru sudah disimpan.')
    navigate('/', { replace: true })
  }

  return (
    <AuthShell title="Buat password baru" subtitle="Pakai minimal 8 karakter yang mudah Anda ingat.">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <PasswordInput
          label="Password baru"
          autoComplete="new-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          required
        />
        <PasswordInput
          label="Konfirmasi password baru"
          autoComplete="new-password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          required
        />
        {error && (
          <Banner tone="danger">
            <span role="alert">{error}</span>
          </Banner>
        )}
        <Button type="submit" block loading={simpan} icon={KeyRound}>
          Simpan password
        </Button>
      </form>
    </AuthShell>
  )
}
