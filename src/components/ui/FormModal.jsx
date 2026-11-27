import { useEffect, useState } from 'react'
import { Button } from './Button'
import { Select, TextInput, Textarea } from './Field'
import { Modal } from './Modal'
import { Banner } from './misc'
import { PilihanCentang, PilihanSatu } from './extra'

/**
 * Form serbaguna dalam jendela dialog.
 * fields: [{ name, label, type, options, required, hint, placeholder, show(values) }]
 *   type: text | tel | number | date | time | datetime-local | url | textarea | select | radio | multi | checkbox
 *   options: select -> [{ value, label }] ; radio/multi -> { value: label }
 * onSubmit(values) -> boleh melempar error (pesannya ditampilkan).
 */
export function FormModal({ open, onClose, title, fields, initial, onSubmit, validate, submitLabel = 'Simpan', wide = true, children }) {
  const [values, setValues] = useState({})
  const [errors, setErrors] = useState({})
  const [umum, setUmum] = useState('')
  const [simpan, setSimpan] = useState(false)

  useEffect(() => {
    if (!open) return
    const awal = {}
    for (const f of fields) awal[f.name] = initial?.[f.name] ?? (f.type === 'multi' ? [] : f.type === 'checkbox' ? false : '')
    setValues({ ...initial, ...awal })
    setErrors({})
    setUmum('')
  }, [open])

  const setNilai = (name, v) => {
    setValues((s) => ({ ...s, [name]: v }))
    setErrors((e) => ({ ...e, [name]: undefined }))
  }

  async function kirim(e) {
    e.preventDefault()
    setUmum('')
    const er = {}
    for (const f of fields) {
      if (f.show && !f.show(values)) continue
      const v = values[f.name]
      if (f.required && (v === '' || v === null || v === undefined || (Array.isArray(v) && v.length === 0))) {
        er[f.name] = `${f.label} wajib diisi.`
      }
    }
    Object.assign(er, validate?.(values) ?? {})
    setErrors(er)
    if (Object.keys(er).length) return setUmum('Ada isian yang perlu diperbaiki.')
    setSimpan(true)
    try {
      await onSubmit(values)
      onClose()
    } catch (err) {
      setUmum(err?.message ?? String(err))
    } finally {
      setSimpan(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      wide={wide}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={simpan}>
            Batal
          </Button>
          <Button type="submit" form="form-modal" loading={simpan}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id="form-modal" onSubmit={kirim} noValidate className="space-y-5">
        {fields.map((f) => {
          if (f.show && !f.show(values)) return null
          const v = values[f.name] ?? ''
          const umumProps = { label: f.label, hint: f.hint, error: errors[f.name], required: f.required, placeholder: f.placeholder }
          switch (f.type) {
            case 'textarea':
              return <Textarea key={f.name} rows={f.rows ?? 3} value={v} onChange={(e) => setNilai(f.name, e.target.value)} {...umumProps} />
            case 'select':
              return (
                <Select key={f.name} value={v} onChange={(e) => setNilai(f.name, e.target.value)} {...umumProps}>
                  <option value="">— pilih —</option>
                  {(typeof f.options === 'function' ? f.options(values) : f.options).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              )
            case 'radio':
              return (
                <PilihanSatu key={f.name} legend={f.label} required={f.required} hint={f.hint} options={f.options} value={v} onChange={(x) => setNilai(f.name, x)} error={errors[f.name]} />
              )
            case 'multi':
              return (
                <div key={f.name}>
                  <PilihanCentang legend={f.label} hint={f.hint} options={f.options} value={v || []} onChange={(x) => setNilai(f.name, x)} />
                  {errors[f.name] && <p className="mt-2 font-semibold text-danger">{errors[f.name]}</p>}
                </div>
              )
            case 'checkbox':
              return (
                <label key={f.name} className="flex min-h-12 cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={Boolean(values[f.name])} onChange={(e) => setNilai(f.name, e.target.checked)} className="mt-1 size-6 shrink-0 accent-primary" />
                  <span>
                    <span className="block font-bold">{f.label}</span>
                    {f.hint && <span className="block text-muted">{f.hint}</span>}
                  </span>
                </label>
              )
            default:
              return (
                <TextInput
                  key={f.name}
                  type={f.type ?? 'text'}
                  inputMode={f.type === 'number' ? 'numeric' : f.type === 'tel' ? 'tel' : undefined}
                  list={f.list}
                  min={f.min}
                  value={v}
                  onChange={(e) => setNilai(f.name, e.target.value)}
                  {...umumProps}
                />
              )
          }
        })}
        {children?.(values, setNilai)}
        {umum && (
          <Banner tone="danger">
            <span role="alert">{umum}</span>
          </Banner>
        )}
      </form>
    </Modal>
  )
}
