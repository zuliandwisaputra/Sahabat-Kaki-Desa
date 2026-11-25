import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Bell, BellOff, CheckCheck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { waktuRelatif } from '../../lib/format'

/**
 * Lonceng notifikasi (Supabase Realtime). Notifikasi dibuat otomatis oleh
 * trigger database: perawat saat ada Kartu Kaki Sehat baru / laporan pendamping,
 * kader saat perawat memberi kode warna dan arahan, admin saat ada akun baru.
 */
export function NotificationBell() {
  const { user, refreshProfile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)
  const uid = user?.id

  const muat = useCallback(async () => {
    if (!uid) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', uid)
      .order('created_at', { ascending: false })
      .limit(30)
    setItems(data ?? [])
  }, [uid])

  useEffect(() => {
    muat()
    if (!uid) return
    const channel = supabase
      .channel(`notifikasi-${uid}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${uid}` },
        (payload) => {
          setItems((prev) => [payload.new, ...prev].slice(0, 30))
          toast.info(payload.new.title)
          refreshProfile() // mis. akun baru disetujui atau peran diubah
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [uid, muat, toast, refreshProfile])

  // Tutup saat klik di luar atau tekan Esc
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const belumDibaca = items.filter((n) => !n.is_read).length

  async function bukaNotifikasi(n) {
    setOpen(false)
    if (!n.is_read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id)
    }
    if (n.link) navigate(n.link)
  }

  async function tandaiSemua() {
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })))
    await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', uid).eq('is_read', false)
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={belumDibaca ? `Notifikasi, ${belumDibaca} belum dibaca` : 'Notifikasi'}
        aria-expanded={open}
        className="relative grid size-12 place-items-center rounded-full border-2 border-line bg-surface text-ink transition-colors hover:bg-soft"
      >
        <Bell aria-hidden="true" className="size-6" />
        {belumDibaca > 0 && (
          <span className="absolute -top-1.5 -right-1.5 grid h-6 min-w-6 place-items-center rounded-full border-2 border-bg bg-danger px-1 text-[15px] font-bold text-white">
            {belumDibaca > 9 ? '9+' : belumDibaca}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-20 z-40 max-h-[75dvh] overflow-hidden rounded-card border border-line bg-surface shadow-2xl sm:absolute sm:inset-x-auto sm:top-14 sm:right-0 sm:w-[400px]">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
            <h2 className="text-lg font-extrabold">Notifikasi</h2>
            {belumDibaca > 0 && (
              <button
                type="button"
                onClick={tandaiSemua}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 font-bold text-primary hover:bg-soft"
              >
                <CheckCheck aria-hidden="true" className="size-5" /> Tandai semua dibaca
              </button>
            )}
          </div>
          <ul className="max-h-[calc(75dvh-60px)] overflow-y-auto">
            {items.length === 0 && (
              <li className="flex flex-col items-center gap-2 px-4 py-10 text-center text-muted">
                <BellOff aria-hidden="true" className="size-8" />
                Belum ada notifikasi.
              </li>
            )}
            {items.map((n) => (
              <li key={n.id} className="border-b border-line last:border-0">
                <button
                  type="button"
                  onClick={() => bukaNotifikasi(n)}
                  className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-soft ${n.is_read ? '' : 'bg-soft/50'}`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-2 size-2.5 shrink-0 rounded-full ${n.is_read ? 'bg-transparent' : 'bg-primary'}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block ${n.is_read ? 'font-semibold' : 'font-extrabold'}`}>
                      {!n.is_read && <span className="sr-only">Belum dibaca: </span>}
                      {n.title}
                    </span>
                    {n.message && <span className="block text-muted">{n.message}</span>}
                    <span className="mt-0.5 block text-base text-muted">{waktuRelatif(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
