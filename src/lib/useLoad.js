import { useCallback, useEffect, useRef, useState } from 'react'
import { pesanError } from './errors'

/**
 * Memuat data secara asinkron. `fn` mengembalikan data (atau melempar error).
 * Hasil: { data, error, loading, reload }
 */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const fnRef = useRef(fn)
  fnRef.current = fn
  const versi = useRef(0)

  const reload = useCallback(async () => {
    const v = ++versi.current
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await fnRef.current()
      if (v === versi.current) setState({ data, error: null, loading: false })
    } catch (e) {
      if (v === versi.current) setState({ data: null, error: pesanError(e), loading: false })
    }
  }, [])

  useEffect(() => {
    reload()
  }, deps)

  return { ...state, reload }
}

/** Lempar error Supabase supaya ditangkap useLoad. */
export function cek({ data, error }) {
  if (error) throw error
  return data
}
