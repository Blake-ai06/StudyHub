import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import AuthLayout from '../components/AuthLayout'
import { FacebookIcon, GoogleIcon } from '../components/SocialIcons'
import { useAuth } from '../lib/auth-context'
import { isSupabaseConfigured, NOT_CONNECTED_MESSAGE, oauthEnabled, setRememberMe, supabase } from '../lib/supabase'

const schema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or username.'),
  password: z.string().min(1, 'Enter your password.'),
  remember: z.boolean(),
})
type Values = z.infer<typeof schema>

const field =
  'w-full rounded-lg border border-slate-200 bg-slate-100/80 py-3 pl-11 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none'

export default function Login() {
  const navigate = useNavigate()
  const { session } = useAuth()
  const [show, setShow] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { identifier: '', password: '', remember: true } })

  if (session) return <Navigate to="/app" replace />

  async function onSubmit(v: Values) {
    setFormError(null)
    setNotice(null)
    if (!isSupabaseConfigured) return setFormError(NOT_CONNECTED_MESSAGE)
    if (!v.identifier.includes('@')) {
      return setFormError('Username login is not enabled yet. Log in with your email address.')
    }
    setRememberMe(v.remember)
    const { error } = await supabase.auth.signInWithPassword({ email: v.identifier, password: v.password })
    if (error) {
      const offline = !navigator.onLine || /fetch|network/i.test(error.message)
      return setFormError(
        offline
          ? 'Cannot reach the server. Check your connection and try again.'
          : error.message === 'Invalid login credentials'
            ? 'Incorrect email or password.'
            : error.message,
      )
    }
    setSuccess(true)
    setTimeout(() => navigate('/app'), 600)
  }

  async function social(provider: 'google' | 'facebook') {
    setFormError(null)
    if (!oauthEnabled[provider]) {
      return setNotice(`${provider === 'google' ? 'Google' : 'Facebook'} login is not set up for this site yet. Use your email and password.`)
    }
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/app` } })
    if (error) setFormError(error.message)
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-extrabold text-navy-900">Welcome Back!</h1>
      <p className="mt-1 text-sm text-slate-500">Log in to your account and continue your learning journey.</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-3">
        <div>
          <label htmlFor="identifier" className="sr-only">Email or username</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input id="identifier" autoComplete="username" placeholder="Email or username" aria-invalid={!!errors.identifier} className={`${field} pr-4`} {...register('identifier')} />
          </div>
          {errors.identifier && <p role="alert" className="mt-1 text-xs text-red-600">{errors.identifier.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="sr-only">Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Password" aria-invalid={!!errors.password} className={`${field} pr-12`} {...register('password')} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center text-slate-500">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p role="alert" className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        <div className="flex items-center justify-between pt-1 text-xs">
          <label className="flex items-center gap-2 text-slate-700">
            <input type="checkbox" className="h-4 w-4 rounded accent-brand" {...register('remember')} />
            Remember me
          </label>
          <Link to="/forgot-password" className="font-semibold text-brand-dark hover:underline">Forgot password?</Link>
        </div>

        {formError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
        {notice && <p role="status" className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">{notice}</p>}
        {success && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Logged in. Redirecting…</p>}

        <button type="submit" disabled={isSubmitting || success} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand font-semibold text-white shadow-[0_8px_20px_rgba(10,150,255,0.3)] hover:bg-brand-dark disabled:opacity-70">
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Log In
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-[11px] font-medium tracking-wider text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />OR CONTINUE WITH<span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" onClick={() => social('google')} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100/80 text-sm font-semibold text-slate-800 hover:bg-white"><GoogleIcon />Google</button>
        <button type="button" onClick={() => social('facebook')} className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100/80 text-sm font-semibold text-slate-800 hover:bg-white"><FacebookIcon />Facebook</button>
      </div>

      <p className="mt-5 text-center text-xs text-slate-500">
        Don't have an account? <Link to="/register" className="font-semibold text-brand-dark hover:underline">Create an account</Link>
      </p>
    </AuthLayout>
  )
}
