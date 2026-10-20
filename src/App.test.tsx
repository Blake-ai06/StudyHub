import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import Landing from './pages/Landing'
import Login from './pages/Login'
import { sessionStorageAdapter, setRememberMe } from './lib/supabase'

test('landing shows the approved headline, hero art, and four feature cards', () => {
  render(<MemoryRouter><Landing /></MemoryRouter>)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Where your study circle never signs off.')
  expect(screen.getByAltText(/three students/i)).toBeInTheDocument()
  for (const t of ['Study Groups', 'Shared Notes', 'Deadlines & Reminders', 'Study Rooms']) {
    expect(screen.getByRole('heading', { name: t })).toBeInTheDocument()
  }
})

test('login validates empty fields and toggles password visibility', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><Login /></MemoryRouter>)
  await user.click(screen.getByRole('button', { name: 'Log In' }))
  expect(await screen.findByText('Enter your email or username.')).toBeInTheDocument()
  expect(screen.getByText('Enter your password.')).toBeInTheDocument()
  const pw = screen.getByPlaceholderText('Password')
  expect(pw).toHaveAttribute('type', 'password')
  await user.click(screen.getByRole('button', { name: 'Show password' }))
  expect(pw).toHaveAttribute('type', 'text')
})

test('unconfigured social login does not pretend to work', async () => {
  const user = userEvent.setup()
  render(<MemoryRouter><Login /></MemoryRouter>)
  await user.click(screen.getByRole('button', { name: /google/i }))
  expect(await screen.findByRole('status')).toHaveTextContent(/not set up/i)
})

test('remember me chooses where the session is stored', () => {
  localStorage.clear(); sessionStorage.clear()
  setRememberMe(false)
  sessionStorageAdapter.setItem('k', 'v')
  expect(sessionStorage.getItem('k')).toBe('v')
  expect(localStorage.getItem('k')).toBeNull()
  setRememberMe(true)
  sessionStorageAdapter.setItem('k', 'v2')
  expect(localStorage.getItem('k')).toBe('v2')
  expect(sessionStorage.getItem('k')).toBeNull()
})
