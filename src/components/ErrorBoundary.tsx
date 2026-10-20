import { Component, type ErrorInfo, type ReactNode } from 'react'

/** Catches crashes (including a lazy page that failed to load after an update) so the user never sees a blank screen. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('StudyHub crashed:', error, info.componentStack) }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main role="alert" className="grid min-h-screen place-items-center bg-navy-900 px-5 text-center text-white">
        <div className="max-w-md">
          <h1 className="text-2xl font-extrabold">Something went wrong</h1>
          <p className="mt-2 text-white/85">The page could not be shown. Your saved drafts and any unsynced changes are still on this device.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={() => window.location.reload()} className="min-h-11 rounded-full bg-brand px-6 font-semibold">Reload</button>
            <a href="/" className="inline-flex min-h-11 items-center rounded-full border border-white/80 px-6 font-semibold">Go to home</a>
          </div>
        </div>
      </main>
    )
  }
}
