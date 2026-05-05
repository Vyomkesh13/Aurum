/**
 * Test route — runs full SOAP pipeline on a synthetic transcript.
 * GET /test/soap (must be logged in)
 *
 * SECURITY: Dev-only. Remove or env-gate before production.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runSoapPipeline } from '@/lib/soap'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'Sign in at /login first' },
      { status: 401 }
    )
  }

  const transcript = `
Patient Raj Patel, 38yo male, MRN 47829, presents today 2024-04-10 with
chest pain that started 3 days ago. Pain is substernal, dull, 4/10, worse
with exertion, relieved by rest. No radiation. Denies shortness of breath,
sweating, nausea. PMH: Type 2 diabetes diagnosed 2019, on metformin 500mg BID.
Father had MI at 55. Current vitals: BP 142/88, HR 78, SpO2 98%.
Patient is anxious about cardiac etiology. Last HbA1c 8.1 in March.
Plan discussed: order ECG, lipid panel, HbA1c. Consider stress test if
ECG shows changes. Continue metformin. Follow up in 1 week.
`.trim()

  try {
    const result = await runSoapPipeline({
      transcript,
      patient: {
        name: 'Raj Patel',
        dateOfBirth: '1985-03-15',
        mrn: '47829',
      },
      patientId: undefined,
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}