import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

/**
 * Jendela dialog (memakai <dialog> bawaan browser: fokus terkunci di dalam,
 * tombol Esc menutup). Di HP tampil sebagai lembar dari bawah layar.
 */
export function Modal({ open, onClose, title, children, footer, wide = false }) {
  const ref = useRef(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        onClose?.()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose?.() // klik di luar kotak
      }}
      className={`fixed inset-x-0 bottom-0 top-auto m-0 max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-card bg-surface p-0 text-ink shadow-2xl sm:inset-0 sm:m-auto sm:h-fit sm:rounded-card ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
            <h2 className="text-xl font-extrabold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className="-mr-2 grid size-12 place-items-center rounded-full hover:bg-soft"
            >
              <X aria-hidden="true" className="size-6" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-3 border-t border-line px-5 py-4 pb-safe">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Ya, lanjutkan', danger, loading }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-lg">{message}</p>
    </Modal>
  )
}
