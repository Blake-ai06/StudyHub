import { FeatureGrid } from '../components/FeatureGrid'
import CtaBand from '../components/CtaBand'
import { OutlineLink, PrimaryLink } from '../components/Buttons'
import PublicHeader from '../components/PublicHeader'
import heroImg from '../assets/hero-students.png'

export default function Landing() {
  return (
    <div>
      <section className="relative overflow-hidden bg-[linear-gradient(90deg,#042c5f_0%,#053067_45%,#093978_100%)] text-white">
        <PublicHeader />
        <div className="mx-auto grid max-w-[1536px] items-end gap-0 px-5 lg:grid-cols-2 lg:px-8 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="pb-8 pt-8 sm:pt-12 lg:pb-24 lg:pt-16">
            <p className="text-sm font-semibold tracking-[0.3em] text-brand">LEARN • CONNECT • ACHIEVE</p>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] sm:text-5xl xl:text-[3.6rem]">
              Where your <br className="hidden sm:block" />
              <span className="text-brand">study circle</span> <br className="hidden sm:block" />
              never signs off.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-white/90 sm:text-lg">
              Notes, groupmates, deadlines, and study rooms — all synced in one hub. Study smarter, together.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryLink to="/register" arrow className="!px-7 !py-3.5">Get Started</PrimaryLink>
              <OutlineLink to="/login" className="!px-9 !py-3.5">Log In</OutlineLink>
            </div>
          </div>
          <div className="-mx-5 lg:mx-0">
            <img
              src={heroImg}
              width={876}
              height={446}
              alt="Three students studying together around a laptop, surrounded by floating group chat, notes, and calendar cards"
              className="ml-auto block h-auto w-full max-w-[876px]"
            />
          </div>
        </div>
      </section>

      <section id="features" className="bg-mist py-14 sm:py-16">
        <div className="mx-auto mb-10 max-w-3xl px-5 text-center">
          <p className="text-xs font-bold tracking-[0.2em] text-brand-dark">WHY STUDYHUB?</p>
          <h2 className="mt-2 text-3xl font-extrabold text-navy-900 sm:text-4xl">Everything you need to succeed</h2>
          <p className="mt-3 text-slate-500">Stay organized, work together, and reach your goals — all in one place.</p>
        </div>
        <FeatureGrid />
      </section>

      <CtaBand />
    </div>
  )
}
