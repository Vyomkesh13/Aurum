import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserPlus, Calendar, Phone } from 'lucide-react'

export default async function PatientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: patients } = await supabase
    .from('patients')
    .select('id, full_name, date_of_birth, gender, phone, blood_type, allergies, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Patients</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {patients?.length ?? 0} {patients?.length === 1 ? 'patient' : 'patients'}
          </p>
        </div>
        <Button className="gap-2" disabled>
          <UserPlus className="h-4 w-4" />
          Add patient
        </Button>
      </div>

      {!patients || patients.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No patients yet. The "Add patient" UI is coming in a later stage.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((p) => (
            <Link key={p.id} href={`/patients/${p.id}`}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
                <CardHeader>
                  <CardTitle className="text-base flex items-start justify-between">
                    <span className="truncate">{p.full_name}</span>
                    {p.blood_type && (
                      <Badge variant="outline" className="text-xs shrink-0 ml-2">
                        {p.blood_type}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  {p.date_of_birth && (
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{age(p.date_of_birth)} years · {p.gender ?? '—'}</span>
                    </div>
                  )}
                  {p.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" />
                      <span className="truncate">{p.phone}</span>
                    </div>
                  )}
                  {p.allergies && p.allergies.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-1">
                      {p.allergies.slice(0, 3).map((a: string) => (
                        <Badge key={a} variant="secondary" className="text-xs">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function age(dob: string): number {
  const d = new Date(dob)
  const ageMs = Date.now() - d.getTime()
  return Math.floor(ageMs / (1000 * 60 * 60 * 24 * 365.25))
}