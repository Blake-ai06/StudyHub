import { zodResolver } from '@hookform/resolvers/zod'
import { AtSign, Download, Loader2, LogOut, Trash2, User } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import FormField from '../components/FormField'
import { canConfirmDelete, deleteMyAccount, downloadJson, exportMyData } from '../lib/account'
import { useAuth } from '../lib/auth-context'
import { useInstall } from '../lib/install'
import { profileSchema } from '../lib/schemas'
import { supabase } from '../lib/supabase'

type Values = z.input<typeof profileSchema>

export default function ProfilePage() {
  const { profile, session, refreshProfile, signOut } = useAuth()
  const { installed } = useInstall()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [dataMsg, setDataMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<Values>({ resolver: zodResolver(profileSchema) })

  useEffect(() => {
    if (profile) reset({ full_name: profile.full_name, username: profile.username, bio: profile.bio ?? '' })
  }, [profile, reset])

  async function onExport() {
    if (!session) return
    setBusy('export'); setDataMsg(null)
    try { downloadJson(await exportMyData(session.user.id), 'studyhub-my-data.json'); setDataMsg({ ok: true, text: 'Your data was downloaded as studyhub-my-data.json.' }) }
    catch { setDataMsg({ ok: false, text: !navigator.onLine ? 'You are offline. Connect to the internet to download your data.' : 'Your data could not be downloaded. Try again.' }) }
    setBusy(null)
  }
  async function onDelete() {
    if (!session || !profile || !canConfirmDelete(confirmText, profile.username)) return
    if (!window.confirm('This permanently deletes your account and everything you created. It cannot be undone. Continue?')) return
    setBusy('delete'); setDataMsg(null)
    try { await deleteMyAccount(session.user.id); await signOut() }
    catch { setDataMsg({ ok: false, text: !navigator.onLine ? 'You are offline. Connect to the internet to delete your account.' : 'Your account could not be deleted. Nothing was removed. Try again.' }); setBusy(null) }
  }

  async function onSubmit(v: Values) {
    setMsg(null)
    if (!session) return
    const { error } = await supabase.from('profiles').update({ full_name: v.full_name, username: v.username.toLowerCase(), bio: v.bio ? v.bio : null }).eq('id', session.user.id)
    if (error) {
      return setMsg({ ok: false, text: error.code === '23505' ? 'That username is already taken.' : !navigator.onLine ? 'You are offline. Try again when connected.' : error.message })
    }
    await refreshProfile()
    setMsg({ ok: true, text: 'Profile saved.' })
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-navy-900">Your profile</h1>
      <p className="mt-1 text-sm text-slate-500">Signed in as {session?.user.email}. Role: <strong className="capitalize">{profile?.role ?? '…'}</strong></p>
      {profile && <Link to={`/app/u/${profile.username}`} className="mt-1 inline-block text-sm font-semibold text-brand-dark underline">View public profile</Link>}
      {!installed && <Link to="/app/install" className="mt-4 flex min-h-12 items-center gap-3 rounded-2xl border border-brand/30 bg-sky-50 px-4 text-sm font-semibold text-brand-dark"><Download className="h-5 w-5" aria-hidden />Install StudyHub on this device</Link>}
      {!profile ? (
        <Loader2 className="mt-8 h-6 w-6 animate-spin text-brand" aria-label="Loading profile" />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-3 rounded-2xl bg-white p-6 shadow">
          <FormField label="Full name" icon={User} error={errors.full_name?.message} {...register('full_name')} />
          <FormField label="Username" icon={AtSign} error={errors.username?.message} {...register('username')} />
          <div>
            <label htmlFor="bio" className="mb-1 block text-xs font-semibold text-slate-600">Bio</label>
            <textarea id="bio" rows={3} className="w-full rounded-lg border border-slate-200 bg-slate-100/80 px-3 py-3 text-sm focus:border-brand focus:bg-white focus:outline-none" {...register('bio')} />
            {errors.bio && <p role="alert" className="mt-1 text-xs text-red-600">{errors.bio.message}</p>}
          </div>
          {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msg.text}</p>}
          <button disabled={isSubmitting || !isDirty} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-6 font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Save changes
          </button>
        </form>
      )}
      {profile && (
        <section className="mt-8 space-y-4 rounded-2xl bg-white p-6 shadow" aria-label="Your data">
          <h2 className="text-lg font-extrabold text-navy-900">Your data</h2>
          <p className="text-sm text-slate-600">You can download a copy of what you created, or delete your account. See the <Link to="/privacy" className="font-semibold text-brand-dark underline">privacy policy</Link>.</p>
          <button onClick={() => void onExport()} disabled={!!busy} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{busy === 'export' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download my data</button>
          <div className="border-t border-slate-100 pt-4">
            <h3 className="font-bold text-red-700">Delete my account</h3>
            <p className="mt-1 text-sm text-slate-600">This permanently deletes your account, posts, messages, and submissions. If you teach classes, those classes and their content are deleted too. To confirm, type your username <strong>{profile.username}</strong>.</p>
            <label htmlFor="del" className="sr-only">Type your username to confirm</label>
            <input id="del" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-100/80 px-3 py-3 text-sm focus:border-red-400 focus:bg-white focus:outline-none" />
            <button onClick={() => void onDelete()} disabled={!!busy || !canConfirmDelete(confirmText, profile.username)} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}Delete my account</button>
          </div>
          {dataMsg && <p role={dataMsg.ok ? 'status' : 'alert'} className={`rounded-lg px-3 py-2 text-sm ${dataMsg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{dataMsg.text}</p>}
        </section>
      )}
      <button onClick={() => void signOut()} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"><LogOut className="h-4 w-4" />Log out</button>
    </div>
  )
}
