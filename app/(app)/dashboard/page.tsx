import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, FileText, Activity, FilePlus, ArrowRight } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { count: patientCount },
    { count: encounterCount },
    { count: soapCount },
    { data: recentActions },
    { data: recentPatients },
  ] = await Promise.all([
    supabase.from('patients').select('*', { count: 'exact', head: true }),
    supabase.from('encounters').select('*', { count: 'exact', head: true }),
    supabase.from('soap_notes').select('*', { count: 'exact', head: true }),
    supabase
      .from('agent_actions')
      .select('id, action_type, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('patients')
      .select('id, full_name, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return (
    <div className="px-8 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back, {user.email}
          </p>
        </div>
        <Link href="/encounters/new">
          <Button className="gap-2">
            <FilePlus className="h-4 w-4" />
            New encounter
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard icon={Users} label="Patients" value={patientCount ?? 0} />
        <StatCard icon={FileText} label="Encounters" value={encounterCount ?? 0} />
        <StatCard icon={Activity} label="SOAP notes generated" value={soapCount ?? 0} />
      </div>

      {/* Two-col content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent agent activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent agent activity</CardTitle>
            <Link
              href="/activity"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {!recentActions || recentActions.length === 0 ? (
              <EmptyState message="No agent actions yet. Generate a SOAP note to get started." />
            ) : (
              <ul className="space-y-3">
                {recentActions.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{prettyAction(a.action_type)}</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        {timeAgo(a.created_at)}
                      </span>
                    </div>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent patients */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent patients</CardTitle>
            <Link
              href="/patients"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {!recentPatients || recentPatients.length === 0 ? (
              <EmptyState message="No patients yet. Add a patient to get started." />
            ) : (
              <ul className="space-y-2">
                {recentPatients.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/patients/${p.id}`}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-secondary/60 -mx-2 transition-colors"
                    >
                      <span className="text-sm font-medium">{p.full_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {timeAgo(p.created_at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
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
  return <Badge variant={variants[status] ?? 'outline'}>{status.replace(/_/g, ' ')}</Badge>
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-sm text-muted-foreground text-center py-8 px-4">
      {message}
    </div>
  )
}

function prettyAction(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
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