import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../lib/supabase'
import { isApproved } from '../lib/permissions'

const AuthContext = createContext(null)

// AUTH-08: sesi berakhir otomatis setelah 7 hari tidak aktif.
// Yang disimpan di browser hanya waktu aktivitas terakhir (bukan password).
const KUNCI_AKTIF = 'skd-terakhir-aktif'
const BATAS_TIDAK_AKTIF = 7 * 24 * 60 * 60 * 1000

function bacaTerakhirAktif() {
  try {
    return Number(localStorage.getItem(KUNCI_AKTIF)) || null
  } catch {
    return null
  }
}
function tandaiAktif() {
  try {
    localStorage.setItem(KUNCI_AKTIF, String(Date.now()))
  } catch {
    /* penyimpanan browser tidak tersedia — abaikan */
  }
}
function hapusTandaAktif() {
  try {
    localStorage.removeItem(KUNCI_AKTIF)
  } catch {
    /* abaikan */
  }
}
function sudahTidakAktif() {
  const t = bacaTerakhirAktif()
  return t !== null && Date.now() - t > BATAS_TIDAK_AKTIF
}

export function AuthProvider({ children }) {
  const navigate = useNavigate()
  const [session, setSession] = useState(undefined) // undefined = sedang dicek
  const [profile, setProfile] = useState(undefined) // undefined = sedang dimuat, null = tidak ada
  const [expiredNotice, setExpiredNotice] = useState(false)

  // Sesi awal + perubahan sesi (masuk, keluar, token diperbarui, reset password)
  useEffect(() => {
    let aktif = true
    supabase.auth.getSession().then(async ({ data }) => {
      let s = data.session
      if (s && sudahTidakAktif()) {
        await supabase.auth.signOut()
        hapusTandaAktif()
        s = null
        if (aktif) setExpiredNotice(true)
      }
      if (aktif) setSession(s)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_IN') tandaiAktif()
      if (event === 'PASSWORD_RECOVERY') navigate('/reset-password', { replace: true })
      setSession(s)
    })
    return () => {
      aktif = false
      sub.subscription.unsubscribe()
    }
  }, [navigate])

  const userId = session?.user?.id

  const refreshProfile = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data ?? null)
  }, [userId])

  // Muat profil hanya saat pengguna berganti (bukan setiap token diperbarui)
  useEffect(() => {
    if (!userId) {
      setProfile(null)
      return
    }
    setProfile(undefined)
    refreshProfile()
  }, [userId, refreshProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    hapusTandaAktif()
    setProfile(null)
  }, [])

  // Catat aktivitas (maksimal sekali per menit) & cek tidak aktif tiap jam
  useEffect(() => {
    if (!userId) return
    tandaiAktif()
    let terakhir = Date.now()
    const onAktif = () => {
      if (Date.now() - terakhir > 60_000) {
        terakhir = Date.now()
        tandaiAktif()
      }
    }
    const events = ['pointerdown', 'keydown', 'visibilitychange']
    events.forEach((e) => window.addEventListener(e, onAktif, { passive: true }))
    const timer = setInterval(async () => {
      if (sudahTidakAktif()) {
        await signOut()
        setExpiredNotice(true)
      }
    }, 60 * 60 * 1000)
    return () => {
      events.forEach((e) => window.removeEventListener(e, onAktif))
      clearInterval(timer)
    }
  }, [userId, signOut])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile: profile ?? null,
      role: profile?.role ?? null,
      approved: isApproved(profile),
      loading: session === undefined || (Boolean(session) && profile === undefined),
      refreshProfile,
      signOut,
      expiredNotice,
      clearExpiredNotice: () => setExpiredNotice(false),
    }),
    [session, profile, refreshProfile, signOut, expiredNotice],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return ctx
}
