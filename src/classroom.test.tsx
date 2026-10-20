import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { isTeacherRole, MATERIAL_MAX, MATERIAL_TYPES, pct, submissionLabel, SUBMISSION_TYPES, summarize, validateFile, validateQuizDraft, type Assignment, type Submission } from './lib/classroom'
import QuizzesTab from './pages/app/class/QuizzesTab'

const due = (iso: string | null): Pick<Assignment, 'due_at'> => ({ due_at: iso })
const sub = (o: Partial<Submission>): Submission => ({ id: 's', assignment_id: 'a', student_id: 'u', body: null, file_path: null, file_name: null, status: 'draft', submitted_at: null, grade: null, feedback: null, graded_at: null, updated_at: null, ...o })

test('submission status never claims "submitted" for a draft', () => {
  const now = Date.parse('2026-10-16T12:00:00Z')
  expect(submissionLabel(null, due('2026-10-20T00:00:00Z'), now)).toBe('Not submitted')
  expect(submissionLabel(null, due('2026-10-01T00:00:00Z'), now)).toBe('Missing')
  expect(submissionLabel(sub({ status: 'draft' }), due(null), now)).toMatch(/not submitted/i)
  expect(submissionLabel(sub({ status: 'submitted', submitted_at: '2026-10-10T00:00:00Z' }), due('2026-10-20T00:00:00Z'), now)).toBe('Submitted')
  expect(submissionLabel(sub({ status: 'submitted', submitted_at: '2026-10-21T00:00:00Z' }), due('2026-10-20T00:00:00Z'), now)).toBe('Submitted late')
  expect(submissionLabel(sub({ status: 'submitted', grade: 90 }), due(null), now)).toBe('Graded')
})

test('file validation enforces type and size', () => {
  expect(validateFile(new File(['x'], 'a.exe', { type: 'application/x-msdownload' }), MATERIAL_TYPES, MATERIAL_MAX)).toMatch(/not allowed/)
  expect(validateFile(new File(['x'], 'a.pdf', { type: 'application/pdf' }), MATERIAL_TYPES, MATERIAL_MAX)).toBeNull()
  expect(validateFile(new File([new Uint8Array(11 * 1048576)], 'a.pdf', { type: 'application/pdf' }), SUBMISSION_TYPES, 10 * 1048576)).toMatch(/10 MB/)
})

test('quiz draft validation catches missing pieces', () => {
  const q = { prompt: 'Capital of France?', points: 1, options: ['Paris', 'Rome', '', ''], correct: 0 }
  expect(validateQuizDraft({ title: '', questions: [q] })).toMatch(/title/)
  expect(validateQuizDraft({ title: 'T', questions: [] })).toMatch(/at least one question/)
  expect(validateQuizDraft({ title: 'T', questions: [{ ...q, prompt: ' ' }] })).toMatch(/needs text/)
  expect(validateQuizDraft({ title: 'T', questions: [{ ...q, options: ['Paris', '', '', ''] }] })).toMatch(/two answer/)
  expect(validateQuizDraft({ title: 'T', questions: [{ ...q, correct: 3 }] })).toMatch(/correct answer/)
  expect(validateQuizDraft({ title: 'T', questions: [q] })).toBeNull()
})

test('grade summary combines graded assignments and quiz scores only', () => {
  const s = summarize({
    assignments: [{ id: 'a1', class_id: 'c', title: 'A', instructions: null, due_at: null, points: 100, created_at: '' }, { id: 'a2', class_id: 'c', title: 'B', instructions: null, due_at: null, points: 50, created_at: '' }],
    quizzes: [{ id: 'q1', class_id: 'c', title: 'Q', description: null, due_at: null, time_limit_min: null, allow_offline: false, published: true, created_at: '' }],
    subs: [sub({ assignment_id: 'a1', status: 'submitted', grade: 80 }), sub({ assignment_id: 'a2', status: 'submitted', grade: null })],
    attempts: [{ id: 't', quiz_id: 'q1', student_id: 'u', submitted_at: '', score: 8, max_score: 10 }],
  })
  expect(s.got).toBe(88); expect(s.max).toBe(110); expect(s.percent).toBe(80); expect(s.done).toBe(3); expect(s.total).toBe(3)
  expect(pct(null, 10)).toBeNull()
})

test('only teachers and admins are treated as teacher roles', () => {
  expect(isTeacherRole('teacher')).toBe(true); expect(isTeacherRole('admin')).toBe(true)
  expect(isTeacherRole('student')).toBe(false); expect(isTeacherRole(undefined)).toBe(false)
})

test('students never see quiz or assignment creation controls', async () => {
  const cls = { id: 'c', teacher_id: 't', name: 'Math', section: null, description: null, join_code: 'ABCD1234', join_enabled: true, archived: false, created_at: '', teacher: { full_name: 'T' } }
  render(<MemoryRouter><QuizzesTab cls={cls} meId="s" isTeacher={false} /></MemoryRouter>)
  expect(screen.queryByRole('button', { name: /new quiz/i })).not.toBeInTheDocument()
})
