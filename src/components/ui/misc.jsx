import { CircleCheck, CircleAlert, Info, LoaderCircle, OctagonAlert, TriangleAlert } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { accessLabel } from '../../lib/permissions'

export function Card({ as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={`rounded-card border border-line bg-surface p-4 shadow-card sm:p-5 ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

const TONES = {
  primary: 'bg-primary-soft text-primary',
  neutral: 'bg-soft text-ink',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
}

export function Badge({ tone = 'neutral', icon: Icon, children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-base font-bold whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {Icon && <Icon aria-hidden="true" className="size-[18px]" />}
      {children}
    </span>
  )
}

// Kode warna Kartu Kaki Sehat — selalu ikon + tulisan + bingkai, tidak hanya warna.
export const KODE_WARNA = {
  hijau: {
    label: 'HIJAU',
    judul: 'Tidak ada tanda bahaya',
    arti: 'Lanjutkan perawatan dan kontrol sesuai jadwal.',
    icon: CircleCheck,
    cls: 'text-hijau bg-hijau-bg border-hijau-line',
  },
  kuning: {
    label: 'KUNING',
    judul: 'Perlu perhatian',
    arti: 'Hubungi kader atau perawat untuk arahan dan jadwal pemeriksaan.',
    icon: TriangleAlert,
    cls: 'text-kuning bg-kuning-bg border-kuning-line',
  },
  merah: {
    label: 'MERAH',
    judul: 'Tanda bahaya',
    arti: 'Segera ke tenaga kesehatan.',
    icon: OctagonAlert,
    cls: 'text-merah bg-merah-bg border-merah-line',
  },
}

export function CodeBadge({ code }) {
  const k = KODE_WARNA[code]
  if (!k) {
    return (
      <span className="inline-flex items-center rounded-xl border-2 border-line bg-surface px-2.5 py-0.5 text-base font-bold whitespace-nowrap text-muted">
        Belum dinilai
      </span>
    )
  }
  const Icon = k.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-2.5 py-0.5 text-base font-extrabold tracking-wide whitespace-nowrap ${k.cls}`}
    >
      <Icon aria-hidden="true" className="size-[18px]" />
      {k.label}
    </span>
  )
}

export function Spinner({ label = 'Memuat…', className = '' }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-3 py-10 text-muted ${className}`}>
      <LoaderCircle aria-hidden="true" className="size-7 animate-spin text-primary" />
      <span className="font-semibold">{label}</span>
    </div>
  )
}

export function EmptyState({ icon: Icon = Info, title, children, action }) {
  return (
    <div className="flex flex-col items-center rounded-card border-2 border-dashed border-line px-5 py-8 text-center">
      <div className="mb-3 grid size-14 place-items-center rounded-full bg-soft text-primary">
        <Icon aria-hidden="true" className="size-7" />
      </div>
      <p className="text-lg font-extrabold">{title}</p>
      {children && <div className="mt-1 max-w-md text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

const BANNER = {
  info: { icon: Info, cls: 'border-line bg-surface' },
  warning: { icon: TriangleAlert, cls: 'border-kuning-line bg-warning-soft text-warning' },
  danger: { icon: CircleAlert, cls: 'border-merah-line bg-danger-soft text-danger' },
  success: { icon: CircleCheck, cls: 'border-hijau-line bg-success-soft text-success' },
}

export function Banner({ tone = 'info', title, children, className = '' }) {
  const { icon: Icon, cls } = BANNER[tone]
  return (
    <div className={`flex gap-3 rounded-field border-2 px-4 py-3 ${cls} ${className}`}>
      <Icon aria-hidden="true" className="mt-0.5 size-6 shrink-0" />
      <div>
        {title && <p className="font-extrabold">{title}</p>}
        <div className="font-semibold">{children}</div>
      </div>
    </div>
  )
}

/** Lencana kecil "Anda bisa mengubah" / "Hanya melihat" di judul halaman. */
export function AccessBadge({ menu }) {
  const { profile } = useAuth()
  const a = accessLabel(profile, menu)
  if (!a) return null
  return <Badge tone={a.tone}>{a.text}</Badge>
}

export function PageHeader({ title, description, menu, actions }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[26px] leading-tight font-extrabold lg:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-muted">{description}</p>}
        {menu && (
          <div className="mt-2">
            <AccessBadge menu={menu} />
          </div>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
