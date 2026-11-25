import { Brand } from '../../components/layout/Brand'

// Tampil jika file .env belum diisi (VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY).
export default function SetupDiperlukan() {
  return (
    <div className="grid min-h-dvh place-items-center bg-hero px-6 py-10">
      <div className="w-full max-w-lg rounded-card border border-line bg-surface p-6 shadow-card">
        <Brand />
        <h1 className="mt-6 text-2xl font-extrabold">Koneksi database belum diatur</h1>
        <p className="mt-2">
          Website belum tahu alamat Supabase. Buat file <code className="rounded bg-soft px-1.5">.env</code> di folder
          proyek (salin dari <code className="rounded bg-soft px-1.5">.env.example</code>), lalu isi:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-field bg-ink p-4 text-base text-white">
          VITE_SUPABASE_URL=...{'\n'}VITE_SUPABASE_ANON_KEY=...
        </pre>
        <p className="mt-3 text-muted">
          Setelah disimpan, hentikan <code>npm run dev</code> (tekan Ctrl+C) lalu jalankan lagi. Panduan lengkap ada di
          README.md.
        </p>
      </div>
    </div>
  )
}
