import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import AuthLayout from '../components/AuthLayout'
import FormField from '../components/FormField'
import { isSupabaseConfigured, NOT_CONNECTED_MESSAGE, supabase } from '../lib/supabase'

const schema = z.object({ email: z.string().trim().email('Enter a valid email address.') })
type Values = z.infer<typeof schema>

export default function ForgotPassword() {
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) })

  async function onSubmit({ email }: Values) {
    setError(null)
    if (!isSupabaseConfigured) return setError(NOT_CONNECTED_MESSAGE)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
    if (err) return setError(!navigator.onLine ? 'Cannot reach the server. Check your connection.' : err.message)
    setSent(true)
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-extrabold text-navy-900">Reset your password</h1>
      <p className="mt-1 text-sm text-slate-500">Enter your email and we will send you a reset link.</p>
      {sent ? (
        <p role="status" className="mt-6 rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">If an account exists for that email, a reset link is on its way.</p>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-3">
          <FormField label="Email" icon={Mail} type="email" autoComplete="email" placeholder="you@school.edu" error={errors.email?.message} {...register('email')} />
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={isSubmitting} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand font-semibold text-white hover:bg-brand-dark disabled:opacity-70">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Send reset link
          </button>
        </form>
      )}
      <p className="mt-5 text-center text-xs text-slate-500"><Link to="/login" className="font-semibold text-brand-dark hover:underline">Back to Log In</Link></p>
    </AuthLayout>
  )
}
