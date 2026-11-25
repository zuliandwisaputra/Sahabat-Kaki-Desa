import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const STYLE = {
  sukses: { icon: CircleCheck, cls: 'border-success/30 bg-success-soft text-success' },
  gagal: { icon: CircleAlert, cls: 'border-danger/30 bg-danger-soft text-danger' },
  info: { icon: Info, cls: 'border-line bg-surface text-ink' },
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const tutup = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])

  const tampil = useCallback(
    (pesan, jenis = 'sukses', durasi = 4500) => {
      const id = ++idRef.current
      setToasts((t) => [...t.slice(-2), { id, pesan, jenis }])
      setTimeout(() => tutup(id), durasi)
    },
    [tutup],
  )

  const api = useMemo(
    () => ({
      sukses: (p) => tampil(p, 'sukses'),
      gagal: (p) => tampil(p, 'gagal', 7000),
      info: (p) => tampil(p, 'info'),
    }),
    [tampil],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-3 bottom-24 z-50 flex flex-col items-center gap-2 lg:bottom-6 lg:left-auto lg:right-6 lg:items-end"
      >
        {toasts.map((t) => {
          const { icon: Icon, cls } = STYLE[t.jenis] ?? STYLE.info
          return (
            <div
              key={t.id}
              role={t.jenis === 'gagal' ? 'alert' : 'status'}
              className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-field border-2 px-4 py-3 font-semibold shadow-card ${cls}`}
            >
              <Icon aria-hidden="true" className="mt-0.5 size-6 shrink-0" />
              <p className="flex-1">{t.pesan}</p>
              <button
                type="button"
                onClick={() => tutup(t.id)}
                aria-label="Tutup pesan"
                className="-m-2 grid size-11 shrink-0 place-items-center rounded-full"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast harus dipakai di dalam <ToastProvider>')
  return ctx
}
