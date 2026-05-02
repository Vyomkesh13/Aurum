/**
 * Main de-identification module.
 *
 * deidentify() — strip PHI, return text + reverse mapping
 * reidentify() — replace tokens with originals (for LLM output)
 *
 * Phase A: regex patterns + structured patient context.
 * Limitation: free-text names not in PatientContext are not detected.
 */

import { PATTERNS } from './patterns'
import type {
  DeidentifiedText,
  IdentifierType,
  PatientContext,
} from './types'

/**
 * Strip identifiers from input text.
 *
 * @param text     The free-text input (e.g. doctor's transcript).
 * @param context  Known patient fields — replaced first, deterministically.
 * @returns        De-identified text + reverse mapping for re-id.
 */
export function deidentify(
  text: string,
  context: PatientContext = {}
): DeidentifiedText {
  const mapping: Record<string, string> = {}
  const counters: Record<IdentifierType, number> = {
    NAME: 0, DATE: 0, PHONE: 0, EMAIL: 0, MRN: 0,
    SSN: 0, ID: 0, URL: 0, IP: 0, ADDRESS: 0,
  }

  let working = text

  // Pass 1 — structured replacement from known patient context.
  // We know these values exactly; replace deterministically.
  const contextReplacements: Array<[string | undefined, IdentifierType]> = [
    [context.name, 'NAME'],
    [context.dateOfBirth, 'DATE'],
    [context.phone, 'PHONE'],
    [context.email, 'EMAIL'],
    [context.mrn, 'MRN'],
    [context.patientId, 'ID'],
  ]

  for (const [value, type] of contextReplacements) {
    if (!value) continue
    const token = nextToken(type, counters, mapping, value)
    working = replaceAll(working, value, token)
  }

  // Pass 2 — regex patterns for everything else.
  for (const rule of PATTERNS) {
    working = working.replace(rule.regex, (match) => {
      // If we already mapped this exact value, reuse the same token.
      const existing = findExistingToken(mapping, match)
      if (existing) return existing
      return nextToken(rule.type, counters, mapping, match)
    })
  }

  return {
    text: working,
    mapping,
    identifiersFound: Object.keys(mapping).length,
  }
}

/**
 * Replace tokens in text with their original values.
 * Used on LLM output before showing to the doctor.
 */
export function reidentify(
  text: string,
  mapping: Record<string, string>
): string {
  let working = text
  // Replace longer tokens first so <NAME_10> doesn't get partially matched by <NAME_1>.
  const tokens = Object.keys(mapping).sort((a, b) => b.length - a.length)
  for (const token of tokens) {
    working = replaceAll(working, token, mapping[token])
  }
  return working
}

// ---------- helpers ----------

function nextToken(
  type: IdentifierType,
  counters: Record<IdentifierType, number>,
  mapping: Record<string, string>,
  value: string
): string {
  counters[type] += 1
  const token = `<${type}_${counters[type]}>`
  mapping[token] = value
  return token
}

function findExistingToken(
  mapping: Record<string, string>,
  value: string
): string | null {
  for (const [token, original] of Object.entries(mapping)) {
    if (original === value) return token
  }
  return null
}

function replaceAll(haystack: string, needle: string, replacement: string): string {
  // Use split/join to avoid regex special-character pitfalls.
  return haystack.split(needle).join(replacement)
}