import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { canConfirmDelete } from './lib/account'
import ErrorBoundary from './components/ErrorBoundary'
import NotFound from './pages/NotFound'

test('account deletion requires typing the exact username', () => {
  expect(canConfirmDelete('jhamel', 'jhamel')).toBe(true)
  expect(canConfirmDelete('  JHAMEL ', 'jhamel')).toBe(true)
  expect(canConfirmDelete('jham', 'jhamel')).toBe(false)
  expect(canConfirmDelete('', 'jhamel')).toBe(false)
  expect(canConfirmDelete('anything', '')).toBe(false)
})

test('the error boundary shows a recovery screen instead of a blank page', () => {
  const Boom = () => { throw new Error('boom') }
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  render(<ErrorBoundary><Boom /></ErrorBoundary>)
  expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
  expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  spy.mockRestore()
})

test('unknown pages show a 404 with a way home', () => {
  render(<MemoryRouter><NotFound /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')
})
