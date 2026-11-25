import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

const INPUT =
  'w-full min-h-13 rounded-field border-2 border-line bg-surface px-4 text-lg text-ink ' +
  'placeholder:text-muted/70 transition-colors focus:border-primary focus:outline-none ' +
  'focus-visible:outline-none focus:ring-4 focus:ring-primary-soft ' +
  'aria-[invalid=true]:border-danger disabled:bg-soft/60 disabled:text-muted'

/**
 * Pembungkus kolom isian: label selalu terlihat, teks bantuan, dan pesan error
 * tepat di bawah kolom (bukan hanya di atas form).
 */
export function Field({ label, hint, error, required, children, className = '' }) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={`space-y-2 ${className}`}>
      <label htmlFor={id} className="block font-bold">
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, required })}
      {hint && (
        <p id={hintId} className="text-base text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-base font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export function TextInput({ label, hint, error, required, className, ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(a11y) => <input className={INPUT} {...a11y} {...rest} />}
    </Field>
  )
}

export function Textarea({ label, hint, error, required, className, rows = 4, ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(a11y) => <textarea rows={rows} className={`${INPUT} py-3 leading-relaxed`} {...a11y} {...rest} />}
    </Field>
  )
}

export function Select({ label, hint, error, required, className, children, ...rest }) {
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(a11y) => (
        <select className={`${INPUT} appearance-none bg-[length:24px] pr-12`} style={{ backgroundImage: CHEVRON, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }} {...a11y} {...rest}>
          {children}
        </select>
      )}
    </Field>
  )
}

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236B4857' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")"

/** AUTH-03: tombol tampil/sembunyikan password */
export function PasswordInput({ label = 'Password', hint, error, required, className, ...rest }) {
  const [tampil, setTampil] = useState(false)
  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(a11y) => (
        <div className="relative">
          <input type={tampil ? 'text' : 'password'} className={`${INPUT} pr-16`} {...a11y} {...rest} />
          <button
            type="button"
            onClick={() => setTampil((v) => !v)}
            aria-label={tampil ? 'Sembunyikan password' : 'Tampilkan password'}
            aria-pressed={tampil}
            className="absolute right-1.5 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-soft hover:text-ink"
          >
            {tampil ? <EyeOff aria-hidden="true" className="size-6" /> : <Eye aria-hidden="true" className="size-6" />}
          </button>
        </div>
      )}
    </Field>
  )
}
