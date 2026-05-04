/**
 * Test route — verifies the audit logger writes to phi_access_log.
 *
 * GET /test/audit — must be called while logged in.
 *
 * SECURITY: Dev-only route. Remove or env-gate before production.
 */

import { NextResponse } from 'next/server'
import { logAccess, logLLMCall } from '@/lib/audit'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { ok: false, error: 'Not authenticated. Sign in first at /login.' },
      { status: 401 }
    )
  }

  // Test 1 — generic logAccess
  const r1 = await logAccess({
    accessType: 'read',
    resourceType: 'patient',
    resourceId: null,
    metadata: { test: 'logAccess generic' },
  })

  // Test 2 — logLLMCall convenience helper
  const r2 = await logLLMCall({
    patientId: null,
    model: 'gemini-2.5-flash',
    deidentified: true,
    inputTokens: 100,
    outputTokens: 50,
    latencyMs: 800,
  })

  // Read back the last 5 audit entries for this doctor
  const { data: recent, error } = await supabase
    .from('phi_access_log')
    .select('access_type, resource_type, metadata, accessed_at')
    .order('accessed_at', { ascending: false })
    .limit(5)

  return NextResponse.json({
    ok: true,
    user: user.email,
    test1_logAccess: r1,
    test2_logLLMCall: r2,
    recentEntries: recent,
    readBackError: error?.message ?? null,
  })
}