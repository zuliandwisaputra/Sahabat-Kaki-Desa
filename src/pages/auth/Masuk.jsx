import { useState } from 'react'
import { Link } from 'react-router'
import { LogIn } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { pesanError } from '../../lib/errors'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../../components/ui/Button'
import { PasswordInput, TextInput } from '../../components/ui/Field'
import { Banner } from '../../components/ui/misc'
import { AuthShell } from './AuthShell'

// AUTH-01: halaman pertama. Bisa masuk dengan username ATAU email.
export default function Masuk() {
  const { expiredNotice, clearExpiredNotice } = useAuth()
  const [identitas, setIdentitas] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    clearExpiredNotice()
    const ident = identitas.trim()
    if (!ident || !password) {
      setError('Isi username/email dan password.')
      return
    }
    setLoading(true)
    try {
      let email = ident
      if (!ident.includes('@')) {
        const { data, error: rpcError } = await supabase.rpc('get_login_email', { p_identifier: ident })
        if (rpcError) throw rpcError
        if (!data) {
          setError('Username/email atau password salah.')
          return
        }
        email = data
      }
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
      if (loginError) throw loginError
      // Berhasil: halaman otomatis pindah ke Beranda (lihat PublicOnly)
    } catch (err) {
      setError(pesanError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Masuk"
      footer={
        <>
          Belum punya akun?{' '}
          <Link to="/daftar" className="font-bold text-primary underline underline-offset-4">
            Daftar
          </Link>
        </>
      }
    >
      {expiredNotice && (
        <Banner tone="info" className="mb-5">
          Sesi Anda berakhir karena tidak aktif selama 7 hari. Silakan masuk lagi.
        </Banner>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <TextInput
          label="Username atau email"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={identitas}
          onChange={(e) => setIdentitas(e.target.value)}
          required
        />
        <div>
          <PasswordInput
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="mt-2 text-right">
            <Link to="/lupa-password" className="font-bold text-primary underline underline-offset-4">
              Lupa password?
            </Link>
          </p>
        </div>
        {error && (
          <Banner tone="danger">
            <span role="alert">{error}</span>
          </Banner>
        )}
        <Button type="submit" block loading={loading} icon={LogIn}>
          Masuk
        </Button>
      </form>
    </AuthShell>
  )
}
