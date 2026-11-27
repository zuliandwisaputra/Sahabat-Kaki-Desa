import { Link } from 'react-router'
import { LoaderCircle } from 'lucide-react'

const VARIANTS = {
  primary: 'bg-primary text-white shadow-button hover:bg-primary-hover',
  secondary: 'border-2 border-primary bg-surface text-primary hover:bg-soft',
  soft: 'bg-primary-soft text-primary hover:bg-soft',
  danger: 'bg-danger text-white hover:bg-red-800',
  quiet: 'bg-transparent text-primary hover:bg-soft',
}
const SIZES = {
  md: 'min-h-13 px-5 text-lg gap-2.5',
  sm: 'min-h-11 px-4 text-base gap-2',
}

export function buttonClass({ variant = 'primary', size = 'md', block = false, className = '' } = {}) {
  return [
    'inline-flex items-center justify-center rounded-field font-bold transition-[background-color,color,transform] duration-150 active:scale-[0.97] disabled:active:scale-100',
    'disabled:cursor-not-allowed disabled:opacity-60',
    VARIANTS[variant],
    SIZES[size],
    block ? 'w-full' : '',
    className,
  ].join(' ')
}

export function Button({
  variant,
  size,
  block,
  loading = false,
  icon: Icon,
  children,
  className,
  type = 'button',
  disabled,
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, block, className })}
      {...rest}
    >
      {loading ? (
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
      ) : (
        Icon && <Icon aria-hidden="true" className={size === 'sm' ? 'size-5' : 'size-6'} />
      )}
      {children}
    </button>
  )
}

export function ButtonLink({ to, variant, size, block, icon: Icon, children, className, ...rest }) {
  return (
    <Link to={to} className={buttonClass({ variant, size, block, className })} {...rest}>
      {Icon && <Icon aria-hidden="true" className={size === 'sm' ? 'size-5' : 'size-6'} />}
      {children}
    </Link>
  )
}

/** Tombol bulat berisi ikon saja — wajib punya label untuk pembaca layar. */
export function IconButton({ label, icon: Icon, className = '', ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-12 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-soft ${className}`}
      {...rest}
    >
      <Icon aria-hidden="true" className="size-6" />
    </button>
  )
}
