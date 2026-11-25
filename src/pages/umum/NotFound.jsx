import { House, SearchX } from 'lucide-react'
import { ButtonLink } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/misc'

export default function NotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Halaman tidak ditemukan"
      action={
        <ButtonLink to="/" icon={House}>
          Ke Beranda
        </ButtonLink>
      }
    >
      Alamat yang Anda buka tidak ada atau sudah dipindahkan.
    </EmptyState>
  )
}
