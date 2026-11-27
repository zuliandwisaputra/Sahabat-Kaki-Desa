import { Brand } from '../../components/layout/Brand'

/** Tampilan bersama halaman Masuk, Daftar, Lupa password. */
export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-dvh bg-bg">
      <div className="bg-hero px-6 pt-12 pb-8 text-center sm:pt-16">
        <div className="flex justify-center">
          <Brand size="lg" />
        </div>
        <p className="mt-2 text-[17px] text-muted">Bersama merawat kaki warga desa</p>
      </div>
      <main className="animasi-halaman mx-auto w-full max-w-md px-5 pb-12">
        <div className="sm:rounded-card sm:border sm:border-line sm:bg-surface sm:p-7 sm:shadow-card">
          <h1 className="text-2xl font-extrabold">{title}</h1>
          {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-[17px] text-muted">{footer}</div>}
      </main>
    </div>
  )
}
