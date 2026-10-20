import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Lock } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import type { z } from 'zod'
import AuthLayout from '../components/AuthLayout'
import FormField from '../components/FormField'
import { useAuth } from '../lib/auth-context'
import { resetSchema } from '../lib/schemas'
import { supabase } from '../lib/supabase'

type Values = z.input<typeof resetSchema>

export default function ResetPassword() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(resetSchema) })

  async function onSubmit(v: Values) {
    setError(null)
    const { error: err } = await supabase.auth.updateUser({ password: v.password })
    if (err) return setError(err.message)
    setDone(true)
    setTimeout(() => navigate('/app'), 900)
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-extrabold text-navy-900">Choose a new password</h1>
      {loading ? (
        <Loader2 className="mt-6 h-6 w-6 animate-spin text-brand" aria-label="Loading" />
      ) : !session ? (
        <>
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">This reset link is invalid or has expired.</p>
          <Link to="/forgot-password" className="mt-4 flex min-h-12 w-full items-center justify-center rounded-lg bg-brand font-semibold text-white hover:bg-brand-dark">Request a new link</Link>
        </>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-3">
          <FormField label="New password" icon={Lock} password autoComplete="new-password" error={errors.password?.message} {...register('password')} />
          <FormField label="Confirm new password" icon={Lock} password autoComplete="new-password" error={errors.confirm?.message} {...register('confirm')} />
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {done && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Password updated. Redirecting…</p>}
          <button type="submit" disabled={isSubmitting || done} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand font-semibold text-white hover:bg-brand-dark disabled:opacity-70">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Update password
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
