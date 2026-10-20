import InstallPanel from '../components/InstallPanel'
import PageShell from '../components/PageShell'

export default function InstallPage() {
  return (
    <PageShell title="Get the StudyHub app" intro="Install it on your phone or computer in a few seconds.">
      <div className="mx-auto max-w-2xl px-5"><InstallPanel /></div>
    </PageShell>
  )
}
