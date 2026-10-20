import { zodResolver } from '@hookform/resolvers/zod'
import { AtSign, Loader2, Lock, Mail, User } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate } from 'react-router-dom'
import type { z } from 'zod'
import AuthLayout from '../components/AuthLayout'
import FormField from '../components/FormField'
import { useAuth } from '../lib/auth-context'
import { registerSchema } from '../lib/schemas'
import { isSupabaseConfigured, NOT_CONNECTED_MESSAGE, setRememberMe, supabase } from '../lib/supabase'

type Values = z.input<typeof registerSchema>

export default function Register() {
  const { session } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', username: '', email: '', password: '', confirm: '', terms: false },
  })

  if (session) return <Navigate to="/app" replace />

  async function onSubmit(v: Values) {
    setFormError(null)
    if (!isSupabaseConfigured) return setFormError(NOT_CONNECTED_MESSAGE)
    setRememberMe(true)
    const { data, error } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        data: { full_name: v.fullName, username: v.username.toLowerCase() },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })
    if (error) {
      const offline = !navigator.onLine || /fetch|network/i.test(error.message)
      return setFormError(offline ? 'Cannot reach the server. Check your connection and try again.' : error.message)
    }
    // With email confirmation on, there is no session yet.
    if (!data.session) setCheckEmail(v.email)
  }

  if (checkEmail) {
    return (
      <AuthLayout>
        <h1 className="text-2xl font-extrabold text-navy-900">Check your email</h1>
        <p role="status" className="mt-2 text-sm text-slate-600">We sent a confirmation link to <strong>{checkEmail}</strong>. Open it, then log in.</p>
        <Link to="/login" className="mt-6 flex min-h-12 w-full items-center justify-center rounded-lg bg-brand font-semibold text-white hover:bg-brand-dark">Go to Log In</Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-extrabold text-navy-900">Create your account</h1>
      <p className="mt-1 text-sm text-slate-500">Join your study circle in a minute.</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-3">
        <FormField label="Full name" icon={User} autoComplete="name" placeholder="Juan Dela Cruz" error={errors.fullName?.message} {...register('fullName')} />
        <FormField label="Username" icon={AtSign} autoComplete="username" placeholder="juan_dc" error={errors.username?.message} {...register('username')} />
        <FormField label="Email" icon={Mail} type="email" autoComplete="email" placeholder="you@school.edu" error={errors.email?.message} {...register('email')} />
        <FormField label="Password" icon={Lock} password autoComplete="new-password" placeholder="At least 8 characters, with a number" error={errors.password?.message} {...register('password')} />
        <FormField label="Confirm password" icon={Lock} password autoComplete="new-password" placeholder="Repeat your password" error={errors.confirm?.message} {...register('confirm')} />
        <div>
          <label className="flex items-start gap-2 text-xs text-slate-700">
            <input type="checkbox" className="mt-0.5 h-4 w-4 rounded accent-brand" {...register('terms')} />
            <span>I agree to the <Link to="/terms" className="font-semibold text-brand-dark hover:underline">Terms</Link> and <Link to="/privacy" className="font-semibold text-brand-dark hover:underline">Privacy Policy</Link>.</span>
          </label>
          {errors.terms && <p role="alert" className="mt-1 text-xs text-red-600">{errors.terms.message}</p>}
        </div>
        {formError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
        <button type="submit" disabled={isSubmitting} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand font-semibold text-white hover:bg-brand-dark disabled:opacity-70">
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Create account
        </button>
      </form>
      <p className="mt-5 text-center text-xs text-slate-500">Already have an account? <Link to="/login" className="font-semibold text-brand-dark hover:underline">Log in</Link></p>
    </AuthLayout>
  )
}
