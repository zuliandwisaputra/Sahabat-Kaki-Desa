import { useEffect, useState } from 'react'
import { inisial } from '../../lib/format'
import { signedUrl } from '../../lib/storage'

const SIZES = {
  sm: 'size-10 text-base',
  md: 'size-12 text-lg',
  lg: 'size-24 text-3xl',
}

/** Foto profil dari bucket privat (signed URL), atau inisial nama jika belum ada foto. */
export function Avatar({ name, path, bucket = 'avatars', size = 'md', className = '' }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    let aktif = true
    setUrl(null)
    if (path) signedUrl(bucket, path).then((u) => aktif && setUrl(u))
    return () => {
      aktif = false
    }
  }, [bucket, path])

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary-soft font-extrabold text-primary ${SIZES[size]} ${className}`}
    >
      {url ? <img src={url} alt="" className="size-full object-cover" /> : <span aria-hidden="true">{inisial(name)}</span>}
    </span>
  )
}
