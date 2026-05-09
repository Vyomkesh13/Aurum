import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Calendar,
  Phone,
  Droplet,
  AlertTriangle,
  FilePlus,
  ChevronLeft,
} from 'lucide-react'

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .single()

  if (!patient) notFound()

  const [{ data: encounters }, { data: soapNotes }, { data: prescriptions }] =
    await Promise.all([
      supabase
        .from('encounters')
        .select('id, encounter_type, chief_complaint, status, started_at')
        .eq('patient_id', id)
        .order('started_at', { ascending: false })
        .limit(10),
      supabase
        .from('soap_notes')
        .select('id, subjective, assessment, created_at')
        .eq('patient_id', id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('prescriptions')
        .select('id, medication, dosage, frequency, status, prescribed_at')
        .eq('patient_id', id)
        .order('prescribed_at', { ascending: false })
        .limit(5),
    ])

  return (
    <div className="px-8 py-8 max-w-7xl">
      <Link
        href="/patients"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ChevronLeft className="h-4 w-4" />
        All patients
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {patient.full_name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Patient ID · {patient.id.slice(0, 8)}
          </p>
        </div>
        <Link href={`/encounters/new?patient=${patient.id}`}>
          <Button className="gap-2">
            <FilePlus className="h-4 w-4" />
            New encounter
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Demographics */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Demographics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row icon={Calendar} label="Age" value={
              patient.date_of_birth ? `${age(patient.date_of_birth)} years` : '—'
            } />
            <Row icon={Calendar} label="DOB" value={patient.date_of_birth ?? '—'} />
            <Row label="Gender" value={patient.gender ?? '—'} />
            <Row icon={Phone} label="Phone" value={patient.phone ?? '—'} />
            <Row icon={Droplet} label="Blood type" value={patient.blood_type ?? '—'} />
            <Separator className="my-2" />
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                Allergies
              </div>
              {patient.allergies && patient.allergies.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {patient.allergies.map((a: string) => (
                    <Badge key={a} variant="secondary">{a}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">None on record</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Encounters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent encounters</CardTitle>
            </CardHeader>
            <CardContent>
              {!encounters || encounters.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No encounters yet.
                </p>
              ) : (
                <ul className="divide-y divide-border -my-2">
                  {encounters.map((e) => (
                    <li key={e.id} className="py-3 flex items-start justify-between">
                      <div>
                        <div className="text-sm font-medium">
                          {e.chief_complaint ?? 'No chief complaint'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {e.encounter_type.replace(/_/g, ' ')} · {formatDate(e.started_at)}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {e.status.replace(/_/g, ' ')}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* SOAP notes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SOAP notes</CardTitle>
            </CardHeader>
            <CardContent>
              {!soapNotes || soapNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No SOAP notes yet.
                </p>
              ) : (
                <ul className="divide-y divide-border -my-2">
                  {soapNotes.map((s) => (
                    <li key={s.id} className="py-3">
                      <div className="text-xs text-muted-foreground mb-1">
                        {formatDate(s.created_at)}
                      </div>
                      <p className="text-sm line-clamp-2">{s.subjective}</p>
                      {s.assessment && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          <span className="font-medium">Assessment:</span> {s.assessment}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Active prescriptions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Prescriptions</CardTitle>
            </CardHeader>
            <CardContent>
              {!prescriptions || prescriptions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No prescriptions on record.
                </p>
              ) : (
                <ul className="divide-y divide-border -my-2">
                  {prescriptions.map((p) => (
                    <li key={p.id} className="py-3 flex items-start justify-between">
                      <div>
                        <div className="text-sm font-medium">{p.medication}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {p.dosage} · {p.frequency}
                        </div>
                      </div>
                      <Badge variant={p.status === 'active' ? 'default' : 'outline'}>
                        {p.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground inline-flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function age(dob: string): number {
  const d = new Date(dob)
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25))
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}