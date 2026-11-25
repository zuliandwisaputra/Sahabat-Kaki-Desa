import { useEffect, useId, useRef, useState } from 'react'
import { Check, ImagePlus, MessageCircle, Phone, X } from 'lucide-react'
import { signedUrl } from '../../lib/storage'
import { linkWA, STATUS_KARTU, STATUS_PASIEN, URUTAN_STATUS_KARTU } from '../../lib/pasien'
import { Badge } from './misc'

export function StatusPasienBadge({ status, archived }) {
  if (archived) return <Badge tone="neutral">Diarsipkan</Badge>
  const s = STATUS_PASIEN[status] ?? STATUS_PASIEN.aktif
  return <Badge tone={s.tone}>{s.label}</Badge>
}

export function StatusKartuBadge({ status }) {
  const s = STATUS_KARTU[status] ?? STATUS_KARTU.draft
  return <Badge tone={s.tone}>{s.label}</Badge>
}

/** KKS-06: penanda tahap Kartu Kaki Sehat */
export function LangkahKartu({ status }) {
  const idx = URUTAN_STATUS_KARTU.indexOf(status)
  return (
    <ol className="grid grid-cols-4 gap-1.5" aria-label="Tahap kartu">
      {URUTAN_STATUS_KARTU.map((s, i) => {
        const selesai = i <= idx
        return (
          <li key={s} aria-current={i === idx ? 'step' : undefined}>
            <span className={`block h-2 rounded-full ${selesai ? 'bg-primary' : 'bg-line'}`} />
            <span className={`mt-1.5 block text-[15px] leading-tight ${selesai ? 'font-bold text-ink' : 'text-muted'}`}>
              {STATUS_KARTU[s].label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** Kotak centang bergaya tombol (mudah ditekan di HP). */
export function PilihanCentang({ legend, options, value, onChange, hint }) {
  return (
    <fieldset>
      <legend className="font-bold">{legend}</legend>
      {hint && <p className="text-base text-muted">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(options).map(([v, label]) => {
          const on = value.includes(v)
          return (
            <label
              key={v}
              className={`inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-2 px-4 font-bold transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary-soft ${
                on ? 'border-primary bg-primary text-white' : 'border-line bg-surface hover:bg-soft'
              }`}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={on}
                onChange={() => onChange(on ? value.filter((x) => x !== v) : [...value, v])}
              />
              {on && <Check aria-hidden="true" className="size-5" />}
              {label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Pilihan tunggal bergaya tombol. */
export function PilihanSatu({ legend, options, value, onChange, error, hint, required }) {
  const id = useId()
  return (
    <fieldset aria-describedby={error ? `${id}-err` : undefined}>
      <legend className="font-bold">
        {legend}
        {required && (
          <span className="text-danger" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </legend>
      {hint && <p className="text-base text-muted">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(options).map(([v, label]) => {
          const on = value === v
          return (
            <label
              key={v}
              className={`inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-2 px-4 font-bold transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary-soft ${
                on ? 'border-primary bg-primary text-white' : 'border-line bg-surface hover:bg-soft'
              }`}
            >
              <input type="radio" className="sr-only" name={id} checked={on} onChange={() => onChange(v)} />
              {on && <Check aria-hidden="true" className="size-5" />}
              {label}
            </label>
          )
        })}
      </div>
      {error && (
        <p id={`${id}-err`} className="mt-2 font-semibold text-danger">
          {error}
        </p>
      )}
    </fieldset>
  )
}

/** Gambar dari bucket privat (signed URL). */
export function GambarPrivat({ bucket, path, alt, className = '' }) {
  const [url, setUrl] = useState(null)
  const [gagal, setGagal] = useState(false)
  useEffect(() => {
    let aktif = true
    setUrl(null)
    setGagal(false)
    if (path)
      signedUrl(bucket, path).then((u) => {
        if (!aktif) return
        if (u) setUrl(u)
        else setGagal(true)
      })
    return () => {
      aktif = false
    }
  }, [bucket, path])
  if (!path) return null
  if (gagal) return <p className="text-muted">Foto tidak bisa dibuka.</p>
  if (!url) return <div className={`animate-pulse rounded-field bg-soft ${className}`} aria-label="Memuat foto" />
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img src={url} alt={alt} className={`rounded-field object-cover ${className}`} />
    </a>
  )
}

/** Pilih foto (opsional) dengan pratinjau. Mengembalikan File lewat onChange. */
export function PilihFoto({ label = 'Foto (opsional)', file, onChange, hint }) {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  useEffect(() => {
    if (!file) return setPreview(null)
    const u = URL.createObjectURL(file)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  return (
    <div>
      <p className="font-bold">{label}</p>
      {hint && <p className="text-base text-muted">{hint}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {preview && (
          <div className="relative">
            <img src={preview} alt="Pratinjau foto" className="size-28 rounded-field object-cover" />
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label="Hapus foto"
              className="absolute -top-2 -right-2 grid size-10 place-items-center rounded-full bg-ink text-white"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex min-h-13 items-center gap-2 rounded-field border-2 border-dashed border-primary/50 px-5 font-bold text-primary hover:bg-soft"
        >
          <ImagePlus aria-hidden="true" className="size-6" />
          {file ? 'Ganti foto' : 'Ambil / pilih foto'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            onChange(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}

/** Tombol telepon & WhatsApp (POS-05, KKS-01 kontak kader). */
export function TombolKontak({ phone, nama, pesan }) {
  if (!phone) return <span className="text-muted">Nomor HP belum ada</span>
  const wa = linkWA(phone, pesan)
  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={`tel:${phone}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-line bg-surface px-4 font-bold hover:bg-soft"
        aria-label={`Telepon ${nama ?? ''}`}
      >
        <Phone aria-hidden="true" className="size-5 text-primary" /> Telepon
      </a>
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-line bg-surface px-4 font-bold hover:bg-soft"
          aria-label={`WhatsApp ${nama ?? ''}`}
        >
          <MessageCircle aria-hidden="true" className="size-5 text-success" /> WhatsApp
        </a>
      )}
    </div>
  )
}

/** Kotak pencarian besar */
export function KotakCari({ value, onChange, placeholder, label }) {
  return (
    <label className="relative block">
      <span className="sr-only">{label ?? placeholder}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-13 w-full rounded-field border-2 border-line bg-surface pr-4 pl-13 text-lg focus:border-primary focus:ring-4 focus:ring-primary-soft focus:outline-none"
      />
    </label>
  )
}

/** Tombol saringan berbentuk pil (dibungkus ke baris baru, tidak digeser). */
export function Saringan({ label, options, value, onChange }) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="tab"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          className={`min-h-11 rounded-full border-2 px-4 font-bold transition-colors ${
            value === o.key ? 'border-primary bg-primary text-white' : 'border-line bg-surface hover:bg-soft'
          }`}
        >
          {o.label}
          {o.count !== undefined ? ` (${o.count})` : ''}
        </button>
      ))}
    </div>
  )
}

/** Baris "label: nilai" untuk detail */
export function Info({ label, children }) {
  return (
    <div className="py-2">
      <dt className="text-base font-bold text-muted">{label}</dt>
      <dd className="text-lg">{children ?? '-'}</dd>
    </div>
  )
}
