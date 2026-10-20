import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import PageShell, { Prose } from '../components/PageShell'
import { FeatureGrid } from '../components/FeatureGrid'
import { isSupabaseConfigured, NOT_CONNECTED_MESSAGE, supabase } from '../lib/supabase'

export function FeaturesPage() {
  return (
    <PageShell title="Everything you need to succeed" intro="Stay organized, work together, and reach your goals — all in one place.">
      <FeatureGrid />
    </PageShell>
  )
}

export function AboutPage() {
  return (
    <PageShell title="About StudyHub" intro="Where your study circle never signs off.">
      <Prose>
        <p>StudyHub brings the social side of studying and the structure of a classroom into one place. Students share notes and join study groups, teachers run classes and assignments, and everyone sees upcoming deadlines in the same hub.</p>
        <h2>Built for how students actually study</h2>
        <p>Download lessons before you go offline, draft posts and answers without a signal, and let StudyHub sync them when you reconnect.</p>
        <h2>Who it is for</h2>
        <ul><li>Students who want to study together.</li><li>Teachers who manage classes, materials, and grades.</li><li>Administrators who keep the community safe.</li></ul>
      </Prose>
    </PageShell>
  )
}

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(80),
  email: z.string().trim().email('Enter a valid email address.'),
  message: z.string().trim().min(10, 'Write at least 10 characters.').max(2000),
})
type ContactValues = z.infer<typeof contactSchema>

export function ContactPage() {
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle')
  const [err, setErr] = useState('')
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ContactValues>({ resolver: zodResolver(contactSchema) })

  async function onSubmit(v: ContactValues) {
    setStatus('idle')
    if (!isSupabaseConfigured) { setErr(NOT_CONNECTED_MESSAGE); return setStatus('error') }
    const { error } = await supabase.from('contact_messages').insert(v)
    if (error) { setErr(navigator.onLine ? 'Your message could not be sent. Try again in a moment.' : 'You are offline. Connect to the internet and send again.'); return setStatus('error') }
    reset(); setStatus('sent')
  }
  const input = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm focus:border-brand focus:outline-none'
  return (
    <PageShell title="Contact us" intro="Questions, feedback, or something not working? Send us a message.">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mx-auto max-w-xl space-y-4 px-5">
        <div><label htmlFor="c-name" className="text-sm font-medium">Name</label><input id="c-name" className={input} {...register('name')} />{errors.name && <p role="alert" className="mt-1 text-xs text-red-600">{errors.name.message}</p>}</div>
        <div><label htmlFor="c-email" className="text-sm font-medium">Email</label><input id="c-email" type="email" className={input} {...register('email')} />{errors.email && <p role="alert" className="mt-1 text-xs text-red-600">{errors.email.message}</p>}</div>
        <div><label htmlFor="c-msg" className="text-sm font-medium">Message</label><textarea id="c-msg" rows={5} className={input} {...register('message')} />{errors.message && <p role="alert" className="mt-1 text-xs text-red-600">{errors.message.message}</p>}</div>
        {status === 'sent' && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Message sent. Thank you.</p>}
        {status === 'error' && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
        <button disabled={isSubmitting} className="min-h-12 w-full rounded-lg bg-brand font-semibold text-white hover:bg-brand-dark disabled:opacity-70">{isSubmitting ? 'Sending…' : 'Send message'}</button>
      </form>
    </PageShell>
  )
}

export function PrivacyPage() {
  return (
    <PageShell title="Privacy Policy" intro="Draft for review. Have your school or a lawyer check it before launch.">
      <Prose>
        <h2>What we collect</h2>
        <p>Account details (name, email, role), content you post, messages, class activity, and files you upload. Downloaded lessons and drafts are also stored on your device so they work offline.</p>
        <h2>How we use it</h2>
        <p>To run StudyHub: show your feed and classes, deliver messages and notifications, and let teachers grade submissions. We do not sell your data.</p>
        <h2>Who can see it</h2>
        <p>Access is enforced by database security rules. Private submissions are visible only to the student and the teacher of that class.</p>
        <h2>Your choices</h2>
        <p>You can edit your profile, clear offline data on your device, and request deletion of your account.</p>
      </Prose>
    </PageShell>
  )
}

export function TermsPage() {
  return (
    <PageShell title="Terms of Use" intro="Draft for review. Have your school or a lawyer check it before launch.">
      <Prose>
        <h2>Using StudyHub</h2>
        <p>Use StudyHub for learning. Keep your login private and be respectful to other members.</p>
        <h2>Your content</h2>
        <p>You own what you post. You allow StudyHub to store and show it to the people you share it with.</p>
        <h2>Not allowed</h2>
        <ul><li>Harassment, hate, or threats.</li><li>Cheating or sharing private exam material.</li><li>Attempts to break or abuse the service.</li></ul>
        <h2>Moderation</h2>
        <p>Administrators may remove content or suspend accounts that break these terms.</p>
      </Prose>
    </PageShell>
  )
}
