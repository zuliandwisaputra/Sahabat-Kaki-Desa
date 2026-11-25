import { supabase } from './supabase'

// Semua bucket privat: file dibuka lewat signed URL (link sementara).
const cache = new Map() // kunci "bucket/path" -> { url, expires }

export async function signedUrl(bucket, path, seconds = 3600) {
  if (!path) return null
  const key = `${bucket}/${path}`
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now() + 60_000) return hit.url
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds)
  if (error) return null
  cache.set(key, { url: data.signedUrl, expires: Date.now() + seconds * 1000 })
  return data.signedUrl
}

/** Kompres foto sebelum diunggah (± maksimal 500 KB, sisi terpanjang 1600 px). */
export async function kompresFoto(file) {
  const { default: imageCompression } = await import('browser-image-compression')
  return imageCompression(file, {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1600,
    useWebWorker: false, // tanpa memuat skrip dari CDN luar
    fileType: 'image/jpeg',
    initialQuality: 0.8,
  })
}

/** Unggah foto (sudah dikompres) ke bucket privat. Mengembalikan path file. */
export async function unggahFoto(bucket, folder, file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('File harus berupa foto (JPG, PNG, atau WEBP).')
  }
  const kecil = await kompresFoto(file)
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  const { error } = await supabase.storage.from(bucket).upload(path, kecil, {
    contentType: 'image/jpeg',
    upsert: false,
  })
  if (error) throw error
  return path
}
