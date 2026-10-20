import type { LucideIcon } from 'lucide-react'
import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useState, type InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  icon: LucideIcon
  error?: string
  password?: boolean
}

export const inputClass =
  'w-full rounded-lg border border-slate-200 bg-slate-100/80 py-3 pl-11 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none'

const FormField = forwardRef<HTMLInputElement, Props>(function FormField({ label, icon: Icon, error, password, id, ...rest }, ref) {
  const [show, setShow] = useState(false)
  const fid = id ?? rest.name
  return (
    <div>
      <label htmlFor={fid} className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input ref={ref} id={fid} aria-invalid={!!error} {...rest} type={password ? (show ? 'text' : 'password') : rest.type} className={`${inputClass} ${password ? 'pr-12' : 'pr-4'}`} />
        {password && (
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center text-slate-500">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
})
export default FormField
