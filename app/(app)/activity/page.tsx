import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Activity as ActivityIcon,
  Brain,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Coins,
} from 'lucide-react'

type AgentAction = {
  id: string
  action_type: string
  model_used: string | null
  input: string
  reasoning_trace: Record<string, unknown> | null
  output: Record<string, unknown> | null
  confidence_score: number | null
  status: string
  autonomy_level: string | null
  latency_ms: number | null
  tokens_used: number | null
  created_at: string
}

type PhiLog = {
  id: string
  access_type: string
  resource_type: string
  metadata: Record<string, unknown> | null
  accessed_at: string
}

export default async function ActivityPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: actions }, { data: phiLogs }] = await Promise.all([
    supabase
      .from('agent_actions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('phi_access_log')
      .select('id, access_type, resource_type, metadata, accessed_at')
      .order('accessed_at', { ascending: false })
      .limit(50),
  ])

  const totalCalls = phiLogs?.filter((l) => l.access_type === 'llm_call').length ?? 0
  const totalReads = phiLogs?.filter((l) => l.access_type === 'read').length ?? 0
  const tokenSum =
    phiLogs
      ?.filter((l) => l.access_type === 'llm_call')
      .reduce((s, l) => {
        const md = l.metadata as Record<string, unknown> | null
        const out = (md?.outputTokens as number) ?? 0
        const inp = (md?.inputTokens as number) ?? 0
        return s + out + inp
      }, 0) ?? 0

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Agent activity</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every agent decision and PHI access is logged immutably. Below is the
          recent audit trail for this account.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatTile icon={Brain} label="LLM calls (recent)" value={totalCalls} />
        <StatTile icon={ShieldCheck} label="PHI reads (recent)" value={totalReads} />
        <StatTile icon={Coins} label="Tokens consumed (recent)" value={tokenSum.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent decisions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ActivityIcon className="h-4 w-4" />
              Agent decisions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!actions || actions.length === 0 ? (
              <EmptyState
                title="No agent decisions yet"
                body="Run a SOAP generation from the New Encounter page — every step gets logged here."
                cta={<Link href="/encounters/new" className="text-sm text-primary hover:underline">Start an encounter →</Link>}
              />
            ) : (
              <ul className="space-y-4">
                {(actions as AgentAction[]).map((a) => (
                  <li key={a.id} className="border-l-2 border-border pl-4 -ml-px">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {prettyAction(a.action_type)}
                          </span>
                          <StatusBadge status={a.status} />
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3">
                          {a.model_used && <span>{a.model_used}</span>}
                          {a.latency_ms != null && (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {(a.latency_ms / 1000).toFixed(1)}s
                            </span>
                          )}
                          {a.tokens_used != null && (
                            <span className="inline-flex items-center gap-1">
                              <Coins className="h-3 w-3" /> {a.tokens_used} tok
                            </span>
                          )}
                          <span>{timeAgo(a.created_at)}</span>
                        </div>
                        {a.confidence_score != null && (
                          <ConfidenceBar value={a.confidence_score} />
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* PHI access log */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              PHI access log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!phiLogs || phiLogs.length === 0 ? (
              <EmptyState
                title="No PHI access events yet"
                body="Every read, write, and LLM call against patient data is logged immutably here."
              />
            ) : (
              <ul className="space-y-3">
                {(phiLogs as PhiLog[]).map((l) => {
                  const md = l.metadata as Record<string, unknown> | null
                  const isLLM = l.access_type === 'llm_call'
                  return (
                    <li key={l.id} className="flex items-start gap-3 text-sm">
                      <AccessIcon type={l.access_type} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {prettyAccess(l.access_type)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {l.resource_type}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                          {isLLM && md && (
                            <>
                              {md.model && <span>model: {String(md.model)}</span>}
                              {md.deidentified !== undefined && (
                                <Badge variant={md.deidentified ? 'default' : 'destructive'} className="text-[10px]">
                                  {md.deidentified ? 'de-identified' : 'identified'}
                                </Badge>
                              )}
                            </>
                          )}
                          <span>{timeAgo(l.accessed_at)}</span>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h3 className="font-medium text-sm">Audit logs are immutable</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              The PHI access log enforces append-only writes via row-level security policies.
              Even an authenticated doctor cannot delete or modify their own access entries.
              This pattern is what HIPAA and DPDP Act require for compliant audit trails.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
}) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className="h-10 w-10 rounded-md bg-secondary grid place-items-center">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">
            {label}
          </div>
          <div className="text-2xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    confirmed: 'default',
    auto_executed: 'secondary',
    pending: 'outline',
    awaiting_confirmation: 'outline',
    rejected: 'destructive',
    failed: 'destructive',
  }
  return (
    <Badge variant={variants[status] ?? 'outline'} className="text-[10px]">
      {status.replace(/_/g, ' ')}
    </Badge>
  )
}

function AccessIcon({ type }: { type: string }) {
  if (type === 'llm_call') return <Brain className="h-4 w-4 text-primary mt-0.5" />
  if (type === 'read') return <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5" />
  if (type === 'delete') return <XCircle className="h-4 w-4 text-destructive mt-0.5" />
  return <ActivityIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const lowConf = value < 0.7
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden max-w-32">
        <div
          className={`h-full transition-all ${
            lowConf ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {lowConf && <AlertTriangle className="h-3 w-3 inline mr-1 text-amber-500" />}
        {pct}% confidence
      </span>
    </div>
  )
}

function EmptyState({ title, body, cta }: { title: string; body: string; cta?: React.ReactNode }) {
  return (
    <div className="text-center py-8 px-4">
      <p className="text-sm font-medium mb-1">{title}</p>
      <p className="text-xs text-muted-foreground mb-3">{body}</p>
      {cta}
    </div>
  )
}

function prettyAction(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function prettyAccess(t: string): string {
  if (t === 'llm_call') return 'LLM Call'
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}