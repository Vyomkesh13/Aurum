import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SoapGenerator } from '@/components/SoapGenerator'
import { Sparkles } from 'lucide-react'

export default async function NewEncounterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Sparkles className="h-3 w-3" />
          AI-assisted documentation
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">New encounter</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste a transcript. Watch the agent pipeline run de-identification,
          retrieval-grounded generation, and self-critique in real time.
        </p>
      </div>

      <SoapGenerator />
    </div>
  )
}