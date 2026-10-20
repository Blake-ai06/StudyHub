import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import InstallPanel from './components/InstallPanel'
import InstallToast from './components/InstallToast'
import { __resetInstallForTests, detectPlatform, initInstall, promptInstall } from './lib/install'

const fakeOffer = (outcome: 'accepted' | 'dismissed' = 'accepted') => {
  const ev = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
  ev.prompt = vi.fn(async () => {}); ev.userChoice = Promise.resolve({ outcome })
  return ev
}
beforeEach(() => { __resetInstallForTests(); localStorage.clear(); initInstall() })

test('detects the device type, including iPads that pretend to be Macs', () => {
  expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios')
  expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios')
  expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('desktop')
  expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('android')
  expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop')
})

test('the browser install offer is remembered and can be used later, once', async () => {
  expect(await promptInstall()).toBe('unavailable')
  const offer = fakeOffer()
  act(() => { window.dispatchEvent(offer) })
  expect(offer.defaultPrevented).toBe(true) // we take over from the browser's automatic mini-bar
  expect(await promptInstall()).toBe('accepted')
  expect(offer.prompt).toHaveBeenCalledTimes(1)
  expect(await promptInstall()).toBe('unavailable') // an offer can only be used one time
})

test('install panel shows the one-tap button only when the browser offered it, and always shows written steps', async () => {
  const user = userEvent.setup()
  render(<InstallPanel />)
  expect(screen.queryByRole('button', { name: 'Install StudyHub' })).not.toBeInTheDocument()
  expect(screen.getByText(/did not offer a one-tap install/i)).toBeInTheDocument()
  expect(screen.getByText(/Android phone or tablet/)).toBeInTheDocument()
  expect(screen.getByText(/iPhone or iPad/)).toBeInTheDocument()
  expect(screen.getByText(/Windows, Mac, or Chromebook/)).toBeInTheDocument()
  const offer = fakeOffer()
  act(() => { window.dispatchEvent(offer) })
  await user.click(await screen.findByRole('button', { name: 'Install StudyHub' }))
  expect(offer.prompt).toHaveBeenCalled()
  expect(await screen.findByText(/Installing\./)).toBeInTheDocument()
})

test('after install, the panel says so and the button is gone', async () => {
  render(<InstallPanel />)
  act(() => { window.dispatchEvent(fakeOffer()) })
  act(() => { window.dispatchEvent(new Event('appinstalled')) })
  expect(await screen.findByText(/StudyHub is installed on this device/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Install StudyHub' })).not.toBeInTheDocument()
})

test('the reminder toast hides for a week on X, but never removes the install option', async () => {
  const user = userEvent.setup()
  const { unmount } = render(<MemoryRouter initialEntries={['/app']}><InstallToast /></MemoryRouter>)
  expect(screen.queryByText('Install StudyHub on this device.')).not.toBeInTheDocument() // nothing offered yet
  act(() => { window.dispatchEvent(fakeOffer()) })
  expect(await screen.findByText('Install StudyHub on this device.')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'How?' })).toHaveAttribute('href', '/app/install')
  await user.click(screen.getByRole('button', { name: /hide the install reminder/i }))
  expect(screen.queryByText('Install StudyHub on this device.')).not.toBeInTheDocument()
  unmount()
  render(<MemoryRouter initialEntries={['/app']}><InstallToast /></MemoryRouter>)
  expect(screen.queryByText('Install StudyHub on this device.')).not.toBeInTheDocument() // still snoozed on the next visit
  render(<MemoryRouter><InstallPanel /></MemoryRouter>)
  expect(await screen.findByRole('button', { name: 'Install StudyHub' })).toBeInTheDocument() // the permanent way in is still there
})

test('the toast does not appear on the install page itself', () => {
  render(<MemoryRouter initialEntries={['/install']}><InstallToast /></MemoryRouter>)
  act(() => { window.dispatchEvent(fakeOffer()) })
  expect(screen.queryByText('Install StudyHub on this device.')).not.toBeInTheDocument()
})
