import { cached } from '../offline/cache'
import { supabase } from './supabase'

export const MATERIAL_TYPES = [
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'image/jpeg', 'image/png', 'image/webp', 'application/zip',
]
export const SUBMISSION_TYPES = MATERIAL_TYPES.filter((t) => t !== 'application/vnd.ms-powerpoint' && t !== 'application/vnd.ms-excel' && t !== 'image/webp')
export const MATERIAL_MAX = 20 * 1024 * 1024
export const SUBMISSION_MAX = 10 * 1024 * 1024
export const FILE_ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp,.zip'

export function validateFile(file: File, allowed: string[], max: number): string | null {
  if (!allowed.includes(file.type)) return 'That file type is not allowed. Use PDF, Word, PowerPoint, Excel, text, image, or ZIP.'
  if (file.size > max) return `The file must be ${Math.round(max / 1048576)} MB or smaller.`
  return null
}
const safeName = (n: string) => n.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80)
export const isTeacherRole = (role?: string | null) => role === 'teacher' || role === 'admin'

export interface ClassRow {
  id: string; teacher_id: string; name: string; section: string | null; description: string | null
  join_code: string; join_enabled: boolean; archived: boolean; created_at: string
  teacher: { full_name: string } | null
}
const CLASS_SELECT = 'id, teacher_id, name, section, description, join_code, join_enabled, archived, created_at, teacher:profiles!teacher_id(full_name)'

export async function fetchMyClassesRaw() {
  const { data, error } = await supabase.from('classes').select(CLASS_SELECT).eq('archived', false).order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as ClassRow[]
}
export async function fetchClassRaw(id: string) {
  const { data, error } = await supabase.from('classes').select(CLASS_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data as unknown as ClassRow | null
}
export async function createClass(c: { teacherId: string; name: string; section?: string; description?: string }) {
  const id = crypto.randomUUID()
  const { error } = await supabase.from('classes').insert({ id, teacher_id: c.teacherId, name: c.name.trim(), section: c.section?.trim() || null, description: c.description?.trim() || null })
  if (error) throw error
  return id
}
/** Returns the class id, or null when the code is wrong or joining is closed. */
export async function joinClass(code: string) {
  const { data, error } = await supabase.rpc('join_class', { p_code: code })
  if (error) throw error
  return (data as string | null) ?? null
}
export async function regenerateCode(cid: string) {
  const { data, error } = await supabase.rpc('regenerate_join_code', { cid })
  if (error) throw error
  return data as string
}
export async function setJoinEnabled(cid: string, enabled: boolean) {
  const { error } = await supabase.from('classes').update({ join_enabled: enabled }).eq('id', cid)
  if (error) throw error
}
export async function archiveClass(cid: string) {
  const { error } = await supabase.from('classes').update({ archived: true }).eq('id', cid)
  if (error) throw error
}

// ---------- members ----------
export interface Member { user_id: string; joined_at: string; user: { username: string; full_name: string; avatar_url: string | null } }
export async function fetchMembersRaw(cid: string) {
  const { data, error } = await supabase.from('enrollments').select('user_id, joined_at, user:profiles!user_id(username, full_name, avatar_url)').eq('class_id', cid).order('joined_at')
  if (error) throw error
  return data as unknown as Member[]
}
export async function removeMember(cid: string, uid: string) {
  const { error } = await supabase.from('enrollments').delete().eq('class_id', cid).eq('user_id', uid)
  if (error) throw error
}

// ---------- announcements ----------
export interface Announcement { id: string; body: string; created_at: string; author: { full_name: string } }
export async function fetchAnnouncementsRaw(cid: string) {
  const { data, error } = await supabase.from('announcements').select('id, body, created_at, author:profiles!author_id(full_name)').eq('class_id', cid).order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return data as unknown as Announcement[]
}
export async function postAnnouncement(a: { classId: string; authorId: string; body: string }) {
  const { error } = await supabase.from('announcements').insert({ id: crypto.randomUUID(), class_id: a.classId, author_id: a.authorId, body: a.body.trim() })
  if (error) throw error
}
export async function deleteAnnouncement(id: string) {
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) throw error
}

// ---------- materials ----------
export interface Material { id: string; title: string; description: string | null; file_path: string | null; file_name: string | null; file_type: string | null; file_size: number | null; created_at: string }
export async function fetchMaterialsRaw(cid: string) {
  const { data, error } = await supabase.from('materials').select('id, title, description, file_path, file_name, file_type, file_size, created_at').eq('class_id', cid).order('created_at', { ascending: false })
  if (error) throw error
  return data as Material[]
}
export async function addMaterial(m: { classId: string; userId: string; title: string; description?: string; file?: File | null }) {
  const id = crypto.randomUUID()
  let file_path: string | null = null
  if (m.file) {
    file_path = `${m.classId}/${id}-${safeName(m.file.name)}`
    const up = await supabase.storage.from('class-files').upload(file_path, m.file, { contentType: m.file.type, upsert: true })
    if (up.error) throw up.error
  }
  const { error } = await supabase.from('materials').insert({
    id, class_id: m.classId, created_by: m.userId, title: m.title.trim(), description: m.description?.trim() || null,
    file_path, file_name: m.file?.name ?? null, file_type: m.file?.type ?? null, file_size: m.file?.size ?? null,
  })
  if (error) { if (file_path) await supabase.storage.from('class-files').remove([file_path]); throw error }
}
export async function deleteMaterial(m: Pick<Material, 'id' | 'file_path'>) {
  const { error } = await supabase.from('materials').delete().eq('id', m.id)
  if (error) throw error
  if (m.file_path) await supabase.storage.from('class-files').remove([m.file_path])
}
export async function signedFileUrl(bucket: 'class-files' | 'submission-files', path: string, filename?: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300, filename ? { download: filename } : undefined)
  if (error) throw error
  return data.signedUrl
}

// ---------- assignments & submissions ----------
export interface Assignment { id: string; class_id: string; title: string; instructions: string | null; due_at: string | null; points: number; created_at: string }
export interface Submission { id: string; assignment_id: string; student_id: string; body: string | null; file_path: string | null; file_name: string | null; status: 'draft' | 'submitted'; submitted_at: string | null; grade: number | null; feedback: string | null; graded_at: string | null; updated_at: string | null }
const SUB_SELECT = 'id, assignment_id, student_id, body, file_path, file_name, status, submitted_at, grade, feedback, graded_at, updated_at'

export async function fetchAssignmentsRaw(cid: string) {
  const { data, error } = await supabase.from('assignments').select('id, class_id, title, instructions, due_at, points, created_at').eq('class_id', cid).order('due_at', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data as Assignment[]
}
export async function fetchAssignmentRaw(id: string) {
  const { data, error } = await supabase.from('assignments').select('id, class_id, title, instructions, due_at, points, created_at').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Assignment | null
}
export async function createAssignment(a: { classId: string; userId: string; title: string; instructions?: string; dueAt?: string | null; points: number }) {
  const { error } = await supabase.from('assignments').insert({ id: crypto.randomUUID(), class_id: a.classId, created_by: a.userId, title: a.title.trim(), instructions: a.instructions?.trim() || null, due_at: a.dueAt || null, points: a.points })
  if (error) throw error
}
export async function deleteAssignment(id: string) {
  const { error } = await supabase.from('assignments').delete().eq('id', id)
  if (error) throw error
}
export async function fetchMySubmissionRaw(aid: string, uid: string) {
  const { data, error } = await supabase.from('submissions').select(SUB_SELECT).eq('assignment_id', aid).eq('student_id', uid).maybeSingle()
  if (error) throw error
  return data as Submission | null
}
/** Saves a draft or submits. The server (not this client) stamps submitted_at, so a submission only counts once this resolves. */
export async function saveSubmission(s: { id: string; assignmentId: string; studentId: string; body: string; file?: File | null; keepFile?: { path: string; name: string } | null; submit: boolean }) {
  let file_path = s.keepFile?.path ?? null
  let file_name = s.keepFile?.name ?? null
  if (s.file) {
    file_path = `${s.assignmentId}/${s.studentId}/${safeName(s.file.name)}`
    const up = await supabase.storage.from('submission-files').upload(file_path, s.file, { contentType: s.file.type, upsert: true })
    if (up.error) throw up.error
    file_name = s.file.name
  }
  const { error } = await supabase.from('submissions').upsert(
    { id: s.id, assignment_id: s.assignmentId, student_id: s.studentId, body: s.body.trim() || null, file_path, file_name, status: s.submit ? 'submitted' : 'draft' },
    { onConflict: 'assignment_id,student_id' },
  )
  if (error) throw error
}
export interface SubmissionWithStudent extends Submission { student: { username: string; full_name: string } }
export async function fetchSubmissions(aid: string) {
  const { data, error } = await supabase.from('submissions').select(`${SUB_SELECT}, student:profiles!student_id(username, full_name)`).eq('assignment_id', aid).order('submitted_at', { ascending: false, nullsFirst: false })
  if (error) throw error
  return data as unknown as SubmissionWithStudent[]
}
export async function gradeSubmission(id: string, grade: number | null, feedback: string) {
  const { error } = await supabase.from('submissions').update({ grade, feedback: feedback.trim() || null }).eq('id', id)
  if (error) throw error
}
export function submissionLabel(s: Submission | null, a: Pick<Assignment, 'due_at'>, now = Date.now()) {
  if (s?.grade != null) return 'Graded'
  if (s?.status === 'submitted') return s.submitted_at && a.due_at && new Date(s.submitted_at) > new Date(a.due_at) ? 'Submitted late' : 'Submitted'
  if (s?.status === 'draft') return 'Draft saved (not submitted)'
  return a.due_at && new Date(a.due_at).getTime() < now ? 'Missing' : 'Not submitted'
}

// ---------- quizzes ----------
export interface Quiz { id: string; class_id: string; title: string; description: string | null; due_at: string | null; time_limit_min: number | null; allow_offline: boolean; published: boolean; created_at: string }
export interface QuizOption { id: string; question_id: string; label: string; position: number }
export interface QuizQuestion { id: string; prompt: string; points: number; position: number; options: QuizOption[] }
const QUIZ_SELECT = 'id, class_id, title, description, due_at, time_limit_min, allow_offline, published, created_at'

export async function fetchQuizzesRaw(cid: string) {
  const { data, error } = await supabase.from('quizzes').select(QUIZ_SELECT).eq('class_id', cid).order('created_at', { ascending: false })
  if (error) throw error
  return data as Quiz[]
}
export async function fetchQuizRaw(id: string) {
  const { data: quiz, error } = await supabase.from('quizzes').select(QUIZ_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  if (!quiz) return null
  const { data: qs, error: e2 } = await supabase.from('quiz_questions').select('id, prompt, points, position, options:quiz_options(id, question_id, label, position)').eq('quiz_id', id).order('position')
  if (e2) throw e2
  const questions = (qs as unknown as QuizQuestion[]).map((q) => ({ ...q, options: [...q.options].sort((a, b) => a.position - b.position) }))
  return { quiz: quiz as Quiz, questions }
}
export interface QuizDraft { classId: string; userId: string; title: string; description?: string; dueAt?: string | null; timeLimit?: number | null; allowOffline: boolean; publish: boolean; questions: { prompt: string; points: number; options: string[]; correct: number }[] }
export function validateQuizDraft(d: Pick<QuizDraft, 'title' | 'questions'>): string | null {
  if (!d.title.trim()) return 'Give the quiz a title.'
  if (d.questions.length === 0) return 'Add at least one question.'
  for (const [i, q] of d.questions.entries()) {
    if (!q.prompt.trim()) return `Question ${i + 1} needs text.`
    const filled = q.options.map((o) => o.trim())
    if (filled.filter(Boolean).length < 2) return `Question ${i + 1} needs at least two answer choices.`
    if (!filled[q.correct]) return `Pick a correct answer for question ${i + 1}.`
  }
  return null
}
export async function createQuiz(d: QuizDraft) {
  const quizId = crypto.randomUUID()
  const ins = async (table: string, rows: object[]) => { if (rows.length) { const { error } = await supabase.from(table).insert(rows); if (error) throw error } }
  // Created unpublished first, so a half-saved quiz is never visible to students.
  await ins('quizzes', [{ id: quizId, class_id: d.classId, created_by: d.userId, title: d.title.trim(), description: d.description?.trim() || null, due_at: d.dueAt || null, time_limit_min: d.timeLimit || null, allow_offline: d.allowOffline, published: false }])
  const qRows: object[] = [], oRows: object[] = [], kRows: object[] = []
  d.questions.forEach((q, qi) => {
    const qid = crypto.randomUUID()
    qRows.push({ id: qid, quiz_id: quizId, prompt: q.prompt.trim(), points: q.points, position: qi })
    let pos = 0
    q.options.forEach((label, oi) => {
      if (!label.trim()) return
      const oid = crypto.randomUUID()
      oRows.push({ id: oid, question_id: qid, label: label.trim(), position: pos++ })
      if (oi === q.correct) kRows.push({ question_id: qid, option_id: oid })
    })
  })
  try {
    await ins('quiz_questions', qRows); await ins('quiz_options', oRows); await ins('quiz_keys', kRows)
    if (d.publish) { const { error } = await supabase.from('quizzes').update({ published: true }).eq('id', quizId); if (error) throw error }
  } catch (e) { await supabase.from('quizzes').delete().eq('id', quizId); throw e }
  return quizId
}
export async function setQuizPublished(id: string, published: boolean) {
  const { error } = await supabase.from('quizzes').update({ published }).eq('id', id)
  if (error) throw error
}
export async function deleteQuiz(id: string) {
  const { error } = await supabase.from('quizzes').delete().eq('id', id)
  if (error) throw error
}
export interface Attempt { id: string; quiz_id: string; student_id: string; submitted_at: string; score: number | null; max_score: number | null }
export async function fetchMyAttemptRaw(quizId: string, uid: string) {
  const { data, error } = await supabase.from('quiz_attempts').select('id, quiz_id, student_id, submitted_at, score, max_score').eq('quiz_id', quizId).eq('student_id', uid).maybeSingle()
  if (error) throw error
  return data as Attempt | null
}
export async function submitQuiz(attemptId: string, quizId: string, answers: Record<string, string>) {
  const { data, error } = await supabase.rpc('submit_quiz', { p_attempt_id: attemptId, p_quiz_id: quizId, p_answers: answers })
  if (error) throw error
  return data as { score: number; max_score: number; already: boolean }
}
export async function fetchQuizAttempts(quizId: string) {
  const { data, error } = await supabase.from('quiz_attempts').select('id, quiz_id, student_id, submitted_at, score, max_score, student:profiles!student_id(username, full_name)').eq('quiz_id', quizId).order('submitted_at', { ascending: false })
  if (error) throw error
  return data as unknown as (Attempt & { student: { username: string; full_name: string } })[]
}

// ---------- grades, progress, deadlines ----------
export const pct = (n: number | null | undefined, max: number | null | undefined) => (n == null || !max ? null : Math.round((n / max) * 100))

export async function fetchMyGrades(cid: string, uid: string) {
  const [assignments, quizzes] = await Promise.all([fetchAssignments(cid), fetchQuizzes(cid)])
  const aIds = assignments.map((a) => a.id), qIds = quizzes.map((q) => q.id)
  const [subs, atts] = await Promise.all([
    aIds.length ? supabase.from('submissions').select(SUB_SELECT).eq('student_id', uid).in('assignment_id', aIds) : Promise.resolve({ data: [] }),
    qIds.length ? supabase.from('quiz_attempts').select('id, quiz_id, student_id, submitted_at, score, max_score').eq('student_id', uid).in('quiz_id', qIds) : Promise.resolve({ data: [] }),
  ])
  return { assignments, quizzes, subs: (subs.data ?? []) as Submission[], attempts: (atts.data ?? []) as Attempt[] }
}
export function summarize(g: Awaited<ReturnType<typeof fetchMyGrades>>) {
  let got = 0, max = 0
  for (const a of g.assignments) { const s = g.subs.find((x) => x.assignment_id === a.id); if (s?.grade != null) { got += Number(s.grade); max += a.points } }
  for (const q of g.quizzes) { const t = g.attempts.find((x) => x.quiz_id === q.id); if (t?.score != null && t.max_score) { got += Number(t.score); max += Number(t.max_score) } }
  const total = g.assignments.length + g.quizzes.filter((q) => q.published).length
  const done = g.subs.filter((s) => s.status === 'submitted').length + g.attempts.length
  return { got, max, percent: pct(got, max), done, total }
}

export interface Deadline { kind: 'assignment' | 'quiz'; id: string; classId: string; className: string; title: string; dueAt: string }
/** Upcoming work the student has not finished yet, soonest first. */
export async function fetchUpcoming(uid: string, classes: ClassRow[]): Promise<Deadline[]> {
  if (classes.length === 0) return []
  const ids = classes.map((c) => c.id), name = new Map(classes.map((c) => [c.id, c.name]))
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const [as, qs, ss, ts] = await Promise.all([
    supabase.from('assignments').select('id, class_id, title, due_at').in('class_id', ids).not('due_at', 'is', null).gte('due_at', since),
    supabase.from('quizzes').select('id, class_id, title, due_at').in('class_id', ids).eq('published', true).not('due_at', 'is', null).gte('due_at', since),
    supabase.from('submissions').select('assignment_id').eq('student_id', uid).eq('status', 'submitted'),
    supabase.from('quiz_attempts').select('quiz_id').eq('student_id', uid),
  ])
  const doneA = new Set((ss.data ?? []).map((r: { assignment_id: string }) => r.assignment_id)), doneQ = new Set((ts.data ?? []).map((r: { quiz_id: string }) => r.quiz_id))
  const out: Deadline[] = []
  for (const a of (as.data ?? []) as { id: string; class_id: string; title: string; due_at: string }[]) if (!doneA.has(a.id)) out.push({ kind: 'assignment', id: a.id, classId: a.class_id, className: name.get(a.class_id) ?? '', title: a.title, dueAt: a.due_at })
  for (const q of (qs.data ?? []) as { id: string; class_id: string; title: string; due_at: string }[]) if (!doneQ.has(q.id)) out.push({ kind: 'quiz', id: q.id, classId: q.class_id, className: name.get(q.class_id) ?? '', title: q.title, dueAt: q.due_at })
  return out.sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 10)
}

export interface TeacherStat { classId: string; students: number; toGrade: number }
export async function fetchTeacherStats(classes: ClassRow[]): Promise<TeacherStat[]> {
  if (classes.length === 0) return []
  const ids = classes.map((c) => c.id)
  const [en, subs] = await Promise.all([
    supabase.from('enrollments').select('class_id').in('class_id', ids),
    supabase.from('submissions').select('id, assignment:assignments!assignment_id(class_id)').eq('status', 'submitted').is('grade', null),
  ])
  const students = new Map<string, number>(), toGrade = new Map<string, number>()
  for (const r of (en.data ?? []) as { class_id: string }[]) students.set(r.class_id, (students.get(r.class_id) ?? 0) + 1)
  for (const r of (subs.data ?? []) as unknown as { assignment: { class_id: string } | null }[]) if (r.assignment) toGrade.set(r.assignment.class_id, (toGrade.get(r.assignment.class_id) ?? 0) + 1)
  return ids.map((id) => ({ classId: id, students: students.get(id) ?? 0, toGrade: toGrade.get(id) ?? 0 }))
}
export async function fetchGradebook(cid: string) {
  const [members, assignments, quizzes] = await Promise.all([fetchMembers(cid), fetchAssignments(cid), fetchQuizzes(cid)])
  const aIds = assignments.map((a) => a.id), qIds = quizzes.map((q) => q.id)
  const [subs, atts] = await Promise.all([
    aIds.length ? supabase.from('submissions').select(SUB_SELECT).in('assignment_id', aIds) : Promise.resolve({ data: [] }),
    qIds.length ? supabase.from('quiz_attempts').select('id, quiz_id, student_id, submitted_at, score, max_score').in('quiz_id', qIds) : Promise.resolve({ data: [] }),
  ])
  return { members, assignments, quizzes, subs: (subs.data ?? []) as Submission[], attempts: (atts.data ?? []) as Attempt[] }
}

// ---------- offline-aware reads: fresh data online, last saved copy when the network is down ----------
export const fetchMyClasses = () => cached('classes', fetchMyClassesRaw)
export const fetchClass = (id: string) => cached(`class:${id}`, () => fetchClassRaw(id))
export const fetchMembers = (cid: string) => cached(`members:${cid}`, () => fetchMembersRaw(cid))
export const fetchAnnouncements = (cid: string) => cached(`announcements:${cid}`, () => fetchAnnouncementsRaw(cid))
export const fetchMaterials = (cid: string) => cached(`materials:${cid}`, () => fetchMaterialsRaw(cid))
export const fetchAssignments = (cid: string) => cached(`assignments:${cid}`, () => fetchAssignmentsRaw(cid))
export const fetchAssignment = (id: string) => cached(`assignment:${id}`, () => fetchAssignmentRaw(id))
export const fetchMySubmission = (aid: string, uid: string) => cached(`submission:${aid}`, () => fetchMySubmissionRaw(aid, uid))
export const fetchQuizzes = (cid: string) => cached(`quizzes:${cid}`, () => fetchQuizzesRaw(cid))
export const fetchQuiz = (id: string) => cached(`quiz:${id}`, () => fetchQuizRaw(id))
export const fetchMyAttempt = (quizId: string, uid: string) => cached(`attempt:${quizId}`, () => fetchMyAttemptRaw(quizId, uid))
