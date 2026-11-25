import { Footprints } from 'lucide-react'

export function Brand({ size = 'md', withText = true }) {
  const big = size === 'lg'
  return (
    <div className={`flex items-center gap-3 ${big ? 'flex-col text-center' : ''}`}>
      <span
        className={`grid shrink-0 place-items-center bg-primary text-white shadow-button ${
          big ? 'size-22 rounded-[28px]' : 'size-11 rounded-2xl'
        }`}
      >
        <Footprints aria-hidden="true" className={big ? 'size-11' : 'size-6'} />
      </span>
      {withText && (
        <span className={`font-extrabold leading-tight ${big ? 'text-[28px]' : 'text-xl'}`}>Sahabat Kaki Desa</span>
      )}
    </div>
  )
}
