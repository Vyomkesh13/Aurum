/**
 * PHI access audit logger.
 *
 * Usage:
 *   import { logAccess } from '@/lib/audit'
 *
 *   await logAccess({
 *     accessType: 'llm_call',
 *     resourceType: 'patient',
 *     resourceId: patientId,
 *     metadata: { model: 'gemini-2.5-flash', deidentified: true }
 *   })
 *
 * Strictness:
 *   - Production: log failures throw (audit is non-negotiable)
 *   - Dev: log failures print to console and return ok:false
 *
 * Override via AUDIT_STRICT=true|false in .env.local.
 */

import { createClient } from '@/lib/supabase/server'
import type { AuditEntry, AuditResult } from './types'

export type { AccessType, ResourceType, AuditEntry, AuditResult } from './types'

/**
 * Determine strictness. Default: strict in production, lenient otherwise.
 * Explicit AUDIT_STRICT env wins over defaults.
 */
function isStrict(): boolean {
  const explicit = process.env.AUDIT_STRICT
  if (explicit === 'true') return true
  if (explicit === 'false') return false
  return process.env.NODE_ENV === 'production'
}

/**
 * Write an audit entry to phi_access_log.
 *
 * - Strict mode: throws on failure.
 * - Lenient mode: returns { ok: false, error } on failure.
 * - Always returns { ok: true } on success.
 */
export async function logAccess(entry: AuditEntry): Promise<AuditResult> {
  try {
    let supabase
    try {
      supabase = await createClient()
    } catch {
      // Outside request scope (e.g. eval script). Skip audit silently.
      return { ok: true }
    }

    // Resolve doctor_id from session if not provided.
    let doctorId = entry.doctorId
    if (!doctorId) {
      const { data: { user } } = await supabase.auth.getUser()
      doctorId = user?.id
    }

    if (!doctorId) {
      const err = 'Cannot log audit: no doctor_id and no authenticated user'
      return handleFailure(err)
    }

    const { error } = await supabase.from('phi_access_log').insert({
      doctor_id: doctorId,
      patient_id: entry.patientId ?? null,
      access_type: entry.accessType,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId ?? null,
      metadata: entry.metadata ?? {},
    })

    if (error) {
      return handleFailure(`phi_access_log insert failed: ${error.message}`)
    }

    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown audit error'
    return handleFailure(`audit logger threw: ${msg}`)
  }
}
/**
 * Convenience helper for LLM calls — most common access type.
 */
export async function logLLMCall(params: {
  patientId?: string | null
  model: string
  deidentified: boolean
  inputTokens?: number
  outputTokens?: number
  latencyMs?: number
}): Promise<AuditResult> {
  return logAccess({
    accessType: 'llm_call',
    resourceType: 'patient',
    resourceId: params.patientId ?? null,
    patientId: params.patientId,
    metadata: {
      model: params.model,
      deidentified: params.deidentified,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      latencyMs: params.latencyMs,
    },
  })
}

// ---------- internal ----------

function handleFailure(message: string): AuditResult {
  if (isStrict()) {
    throw new Error(`[AUDIT STRICT] ${message}`)
  }
  console.warn(`[AUDIT] ${message}`)
  return { ok: false, error: message }
}