import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RequireAuth from './components/RequireAuth'
import { registerSchema, resetSchema } from './lib/schemas'
import Register from './pages/Register'

const good = { fullName: 'Juan Cruz', username: 'Juan_01', email: 'j@school.edu', password: 'abcd1234', confirm: 'abcd1234', terms: true }

test('register schema accepts valid data and normalizes username', () => {
  const r = registerSchema.safeParse(good)
  expect(r.success).toBe(true)
  if (r.success) expect(r.data.username).toBe('juan_01')
})

test('register schema rejects weak passwords, mismatches, bad usernames, missing terms', () => {
  expect(registerSchema.safeParse({ ...good, password: 'short1', confirm: 'short1' }).success).toBe(false)
  expect(registerSchema.safeParse({ ...good, password: 'onlyletters', confirm: 'onlyletters' }).success).toBe(false)
  expect(registerSchema.safeParse({ ...good, confirm: 'different1' }).success).toBe(false)
  expect(registerSchema.safeParse({ ...good, username: 'a b' }).success).toBe(false)
  expect(registerSchema.safeParse({ ...good, terms: false }).success).toBe(false)
  expect(resetSchema.safeParse({ password: 'abcd1234', confirm: 'abcd1234' }).success).toBe(true)
})

test('register form shows validation errors on empty submit', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><Register /></MemoryRouter>)
  await user.click(screen.getByRole('button', { name: 'Create account' }))
  expect(await screen.findByText('Enter your full name.')).toBeInTheDocument()
  expect(screen.getByText('Accept the Terms and Privacy Policy to continue.')).toBeInTheDocument()
})

test('protected routes redirect signed-out visitors to login', () => {
  render(
    <MemoryRouter initialEntries={['/app']}>
      <Routes>
        <Route path="/login" element={<p>login page</p>} />
        <Route path="/app" element={<RequireAuth><p>secret</p></RequireAuth>} />
      </Routes>
    </MemoryRouter>,
  )
  expect(screen.getByText('login page')).toBeInTheDocument()
  expect(screen.queryByText('secret')).not.toBeInTheDocument()
})
