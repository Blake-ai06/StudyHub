import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { postSchema } from '../../lib/schemas'
import { clearDraft, getDraft, useDraftSaver } from '../../offline/drafts'
import { runOrQueue } from '../../offline/outbox'
import { validateImage, type Visibility } from '../../lib/social'
import Avatar from './Avatar'

interface Values { body: string; visibility: Visibility }

export default function Composer({ meId, name, avatarUrl, onPosted }: { meId: string; name: string; avatarUrl?: string | null; onPosted: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(postSchema),
    defaultValues: { body: '', visibility: 'public' },
  })
  const length = watch('body')?.length ?? 0
  const saveDraftLater = useDraftSaver(meId, 'post:new')
  useEffect(() => { void getDraft(meId, 'post:new').then((d) => { if (d) reset({ body: d, visibility: 'public' }) }) }, [meId, reset])
  useEffect(() => { const sub = watch((v) => saveDraftLater(v.body ?? '')); return () => sub.unsubscribe() }, [watch, saveDraftLater])

  function pick(f: File | undefined) {
    if (!f) return
    const problem = validateImage(f)
    if (problem) { setError(problem); return }
    setError(null); setFile(f)
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(f) })
  }
  function clearFile() {
    setFile(null); setPreview((old) => { if (old) URL.revokeObjectURL(old); return null }); if (fileRef.current) fileRef.current.value = ''
  }

  async function onSubmit(v: Values) {
    setError(null); setNotice(null)
    try {
      const result = await runOrQueue('post.create', meId, `Post: ${v.body.trim().slice(0, 40)}`, { id: crypto.randomUUID(), authorId: meId, body: v.body, visibility: v.visibility, file, fileName: file?.name, fileType: file?.type })
      reset({ body: '', visibility: v.visibility }); clearFile(); void clearDraft(meId, 'post:new')
      if (result === 'queued') setNotice('Saved on this device. It will post automatically when you are back online. It is not published yet.')
      onPosted()
    } catch (e) {
      setError((e as Error).message || 'Your post could not be sent. Try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_6px_20px_rgba(15,60,130,0.06)]">
      <div className="flex gap-3">
        <Avatar name={name} url={avatarUrl} />
        <div className="min-w-0 flex-1">
          <label htmlFor="post-body" className="sr-only">What are you studying?</label>
          <textarea id="post-body" rows={3} placeholder="Share a question, note, or update with your study circle…" className="w-full resize-none rounded-xl border border-slate-200 bg-slate-100/80 p-3 text-[15px] focus:border-brand focus:bg-white focus:outline-none" {...register('body')} />
          {errors.body && <p role="alert" className="mt-1 text-xs text-red-600">{errors.body.message}</p>}
          {preview && (
            <div className="relative mt-2 inline-block">
              <img src={preview} alt="Selected attachment preview" className="max-h-48 rounded-xl" />
              <button type="button" onClick={clearFile} aria-label="Remove image" className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white"><X className="h-4 w-4" /></button>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" id="post-image" onChange={(e) => pick(e.target.files?.[0])} />
            <label htmlFor="post-image" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100"><ImagePlus className="h-5 w-5" />Photo</label>
            <label className="sr-only" htmlFor="post-visibility">Who can see this</label>
            <select id="post-visibility" className="min-h-11 rounded-lg border border-slate-200 bg-white px-2 text-sm" {...register('visibility')}>
              <option value="public">Everyone</option>
              <option value="connections">Connections only</option>
            </select>
            <span className={`ml-auto text-xs ${length > 2000 ? 'text-red-600' : 'text-slate-400'}`}>{length}/2000</span>
            <button disabled={isSubmitting} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-6 font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Post
            </button>
          </div>
          {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {notice && <p role="status" className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">{notice}</p>}
        </div>
      </div>
    </form>
  )
}
