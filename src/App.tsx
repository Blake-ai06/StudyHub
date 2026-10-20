import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import RequireAuth from './components/RequireAuth'
import AuthProvider from './lib/AuthProvider'
import Landing from './pages/Landing'
import Login from './pages/Login'
import ErrorBoundary from './components/ErrorBoundary'
import InstallToast from './components/InstallToast'
import NotFound from './pages/NotFound'

// Everything except the landing page and login is split into its own chunk, so the first load stays small.
const AppShell = lazy(() => import('./components/app/AppShell'))
const Register = lazy(() => import('./pages/Register'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const OfflineFallback = lazy(() => import('./pages/OfflineFallback'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const FeedPage = lazy(() => import('./pages/app/FeedPage'))
const CreatePage = lazy(() => import('./pages/app/CreatePage'))
const ClassesPage = lazy(() => import('./pages/app/ClassesPage'))
const ClassPage = lazy(() => import('./pages/app/ClassPage'))
const AssignmentPage = lazy(() => import('./pages/app/AssignmentPage'))
const QuizPage = lazy(() => import('./pages/app/QuizPage'))
const PeoplePage = lazy(() => import('./pages/app/PeoplePage'))
const NotificationsPage = lazy(() => import('./pages/app/NotificationsPage'))
const BookmarksPage = lazy(() => import('./pages/app/BookmarksPage'))
const PublicProfilePage = lazy(() => import('./pages/app/PublicProfilePage'))
const InstallPage = lazy(() => import('./pages/InstallPage'))
const InstallAppPage = lazy(() => import('./pages/app/InstallAppPage'))
const OfflinePage = lazy(() => import('./pages/app/OfflinePage'))
const ConversationList = lazy(() => import('./pages/app/MessagesPage').then((m) => ({ default: m.ConversationList })))
const ThreadPage = lazy(() => import('./pages/app/MessagesPage').then((m) => ({ default: m.ThreadPage })))
const FeaturesPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.FeaturesPage })))
const AboutPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.AboutPage })))
const ContactPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.ContactPage })))
const PrivacyPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.PrivacyPage })))
const TermsPage = lazy(() => import('./pages/StaticPages').then((m) => ({ default: m.TermsPage })))

const Loading = () => <div className="grid min-h-screen place-items-center bg-mist text-slate-500" role="status">Loading…</div>

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/features" element={<FeaturesPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/offline" element={<OfflineFallback />} />
            <Route path="/install" element={<InstallPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route index element={<FeedPage />} />
              <Route path="create" element={<CreatePage />} />
              <Route path="classes" element={<ClassesPage />} />
              <Route path="classes/:id" element={<ClassPage />} />
              <Route path="classes/:id/assignments/:aid" element={<AssignmentPage />} />
              <Route path="classes/:id/quizzes/:qid" element={<QuizPage />} />
              <Route path="people" element={<PeoplePage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="bookmarks" element={<BookmarksPage />} />
              <Route path="messages" element={<ConversationList />} />
              <Route path="messages/:id" element={<ThreadPage />} />
              <Route path="offline" element={<OfflinePage />} />
              <Route path="install" element={<InstallAppPage />} />
              <Route path="me" element={<ProfilePage />} />
              <Route path="u/:username" element={<PublicProfilePage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <InstallToast />
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  )
}
