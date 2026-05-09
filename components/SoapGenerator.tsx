'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  CheckCircle2,
  Loader2,
  Circle,
  XCircle,
  Sparkles,
  ShieldCheck,
  Tags,
  FileText,
  Gauge,
  AlertTriangle,
} from 'lucide-react'

type StageKey = 'deidentify' | 'keywords' | 'generate' | 'critique' | 'gate' | 'reidentify'
type StageStatus = 'idle' | 'running' | 'done' | 'failed'

type Critique = {
  hallucination: number
  omission: number
  faithfulness: number
  groundedness: number
  bias: number
  fluency: number
  completeness: number
  confidence: number
  flags: string[]
}

type SoapNote = {
  subjective: string
  objective: string
  assessment: string
  plan: string
}

type FinalPayload = {
  note: SoapNote
  keywords: string[]
  critique: Critique
  chunksRetrieved: number
  totalTokens: number
}

const STAGES: { key: StageKey; label: string; sub: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'deidentify', label: 'De-identify', sub: 'Strip PHI before LLM', Icon: ShieldCheck },
  { key: 'keywords', label: 'Extract keywords', sub: 'Medical terms for focus', Icon: Tags },
  { key: 'generate', label: 'Generate SOAP', sub: 'RAG-grounded sequential generation', Icon: FileText },
  { key: 'critique', label: 'Self-critique', sub: 'Independent quality scoring', Icon: Sparkles },
  { key: 'gate', label: 'Autonomy gate', sub: 'Confidence threshold check', Icon: Gauge },
  { key: 'reidentify', label: 'Re-identify', sub: 'Restore patient identifiers', Icon: ShieldCheck },
]

export function SoapGenerator() {
  const [transcript, setTranscript] = useState('')
  const [patientName, setPatientName] = useState('')
  const [patientDob, setPatientDob] = useState('')
  const [patientMrn, setPatientMrn] = useState('')

  const [running, setRunning] = useState(false)
  const [stages, setStages] = useState<Record<StageKey, StageStatus>>({
    deidentify: 'idle',
    keywords: 'idle',
    generate: 'idle',
    critique: 'idle',
    gate: 'idle',
    reidentify: 'idle',
  })
  const [stageMeta, setStageMeta] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<FinalPayload | null>(null)

  async function run() {
    if (!transcript.trim() || transcript.length < 20) {
      setError('Transcript must be at least 20 characters.')
      return
    }
    setRunning(true)
    setError(null)
    setResult(null)
    setStages({
      deidentify: 'idle',
      keywords: 'idle',
      generate: 'idle',
      critique: 'idle',
      gate: 'idle',
      reidentify: 'idle',
    })
    setStageMeta({})

    try {
      const res = await fetch('/api/soap/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          patient: {
            name: patientName || undefined,
            dateOfBirth: patientDob || undefined,
            mrn: patientMrn || undefined,
          },
        }),
      })

      if (!res.ok || !res.body) {
        throw new Error(`Server returned ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Parse SSE frames
        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''
        for (const frame of frames) {
          if (!frame.startsWith('data: ')) continue
          const json = frame.slice(6).trim()
          if (!json) continue
          try {
            const event = JSON.parse(json)
            handleEvent(event)
          } catch {
            // ignore malformed frame
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setRunning(false)
    }
  }

  function handleEvent(event: {
    stage: StageKey | 'done' | 'error'
    status?: string
    message?: string
    payload?: unknown
  }) {
    if (event.stage === 'error') {
      setError(event.message ?? 'Pipeline error')
      return
    }
    if (event.stage === 'done') {
      setResult(event.payload as FinalPayload)
      return
    }
    setStages((prev) => ({
      ...prev,
      [event.stage]: event.status === 'done' ? 'done' : 'running',
    }))
    if (event.payload) {
      setStageMeta((prev) => ({ ...prev, [event.stage]: event.payload }))
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT: Input */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Patient context</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="e.g. Raj Patel" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dob">Date of birth</Label>
              <Input id="dob" type="date" value={patientDob} onChange={(e) => setPatientDob(e.target.value)} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label htmlFor="mrn">MRN</Label>
              <Input id="mrn" value={patientMrn} onChange={(e) => setPatientMrn(e.target.value)} placeholder="Optional" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transcript</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={14}
              placeholder="Paste your visit transcript here..."
              className="resize-none"
            />
            <Button onClick={run} disabled={running} className="mt-4 w-full gap-2">
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate SOAP note
                </>
              )}
            </Button>
            {error && (
              <p className="mt-3 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RIGHT: Pipeline + Output */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {STAGES.map(({ key, label, sub, Icon }) => {
              const status = stages[key]
              return (
                <div key={key} className="flex items-start gap-3">
                  <StageIndicator status={status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">{label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
                    <StageMeta stage={key} meta={stageMeta} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {result && <ResultPanel result={result} />}
      </div>
    </div>
  )
}

function StageIndicator({ status }: { status: StageStatus }) {
  if (status === 'done') return <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
  if (status === 'running') return <Loader2 className="h-5 w-5 text-primary animate-spin mt-0.5" />
  if (status === 'failed') return <XCircle className="h-5 w-5 text-destructive mt-0.5" />
  return <Circle className="h-5 w-5 text-muted-foreground/30 mt-0.5" />
}

function StageMeta({
  stage,
  meta,
}: {
  stage: StageKey
  meta: Record<string, unknown>
}) {
  const m = meta[stage] as Record<string, unknown> | undefined
  if (!m) return null

  if (stage === 'deidentify' && typeof m.identifiersFound === 'number') {
    return <Badge variant="secondary" className="mt-1 text-[10px]">{m.identifiersFound} PHI tokens stripped</Badge>
  }
  if (stage === 'keywords' && Array.isArray(m.keywords)) {
    return (
      <div className="flex flex-wrap gap-1 mt-2">
        {(m.keywords as string[]).slice(0, 6).map((k) => (
          <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>
        ))}
      </div>
    )
  }
  if (stage === 'generate' && typeof m.chunksRetrieved === 'number') {
    return <Badge variant="secondary" className="mt-1 text-[10px]">{m.chunksRetrieved} sources retrieved</Badge>
  }
  if (stage === 'critique' && m.critique) {
    const c = m.critique as Critique
    return <Badge variant="secondary" className="mt-1 text-[10px]">Confidence {Math.round(c.confidence * 100)}%</Badge>
  }
  if (stage === 'gate') {
    const requiresReview = m.requiresReview
    return (
      <Badge
        variant={requiresReview ? 'destructive' : 'default'}
        className="mt-1 text-[10px]"
      >
        {requiresReview ? 'Doctor review required' : 'Confidence acceptable'}
      </Badge>
    )
  }
  return null
}

function ResultPanel({ result }: { result: FinalPayload }) {
  const c = result.critique
  const lowConfidence = c.confidence < 0.7

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          Generated SOAP note
          {lowConfidence && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Low confidence
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Section title="Subjective" body={result.note.subjective} />
        <Section title="Objective" body={result.note.objective} />
        <Section title="Assessment" body={result.note.assessment} />
        <Section title="Plan" body={result.note.plan} />

        <Separator />

        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Critique scores
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Score label="Hallucination" value={c.hallucination} lowerBetter />
            <Score label="Omission" value={c.omission} lowerBetter />
            <Score label="Faithfulness" value={c.faithfulness} />
            <Score label="Groundedness" value={c.groundedness} />
            <Score label="Bias" value={c.bias} lowerBetter />
            <Score label="Fluency" value={c.fluency} />
          </div>
          {c.flags.length > 0 && (
            <div className="mt-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
              <div className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                Critique flags
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                {c.flags.map((f, i) => <li key={i}>• {f}</li>)}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{title}</div>
      <p className="whitespace-pre-wrap leading-relaxed">{body}</p>
    </div>
  )
}

function Score({
  label,
  value,
  lowerBetter = false,
}: {
  label: string
  value: number
  lowerBetter?: boolean
}) {
  const good = lowerBetter ? value <= 2 : value >= 4
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={good ? 'text-emerald-600 font-medium' : 'text-foreground'}>{value}/5</span>
    </div>
  )
}