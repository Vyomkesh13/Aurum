import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, Sparkles, ShieldCheck, FileSearch } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-semibold text-sm">
              A
            </div>
            <span className="font-semibold tracking-tight">Aurum</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-16">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs text-muted-foreground mb-6">
            <Sparkles className="h-3 w-3" />
            Agentic AI for clinicians
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-6 leading-[1.1]">
            The clinical AI that{' '}
            <span className="text-primary">shows its work</span>.
          </h1>
          <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
            Aurum generates SOAP notes from doctor-patient transcripts using a
            6-stage agentic pipeline with de-identification, retrieval-grounded
            reasoning, and self-critique. Every claim cites its source. Every
            decision is auditable.
          </p>
          <div className="flex items-center gap-3">
            <Link href="/signup">
              <Button size="lg" className="gap-2">
                Try the demo
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="https://github.com/Vyomkesh13/Aurum" target="_blank">
              <Button variant="outline" size="lg">View on GitHub</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Feature pillars */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            icon={ShieldCheck}
            title="HIPAA-aware by design"
            body="Every patient identifier is stripped before reaching the LLM. Re-identified only on the doctor's screen. Full audit trail of every PHI access."
          />
          <FeatureCard
            icon={FileSearch}
            title="Grounded in evidence"
            body="Retrieval over the WHO Essential Medicines list. Claims cite their source. No silent hallucinations."
          />
          <FeatureCard
            icon={Sparkles}
            title="Self-critiquing pipeline"
            body="Independent judge scores every note across 7 dimensions. Confidence below threshold triggers mandatory doctor review."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-6 text-xs text-muted-foreground flex justify-between">
          <span>Aurum — Portfolio demonstration. Synthetic data only. Not medical advice.</span>
          <span>© 2026</span>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  body: string
}) {
  return (
    <div className="rounded-lg border border-border p-6 bg-card hover:border-primary/40 transition-colors">
      <div className="h-10 w-10 rounded-md bg-secondary grid place-items-center mb-4">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  )
}