/**
 * De-identification types.
 * Phase A: regex + structured patient fields.
 * Phase B: extend with medical NER for free-text names/locations.
 */

// Categories of identifiers we recognize.
// Maps to HIPAA Safe Harbor where applicable.
export type IdentifierType =
  | 'NAME'
  | 'DATE'
  | 'PHONE'
  | 'EMAIL'
  | 'MRN'
  | 'SSN'
  | 'ID'
  | 'URL'
  | 'IP'
  | 'ADDRESS'

// Known patient context — passed in when we already know the values
// (e.g. loaded from DB before passing transcript to LLM).
export type PatientContext = {
  name?: string
  dateOfBirth?: string
  phone?: string
  email?: string
  mrn?: string
  patientId?: string
}

// Result of de-identification.
export type DeidentifiedText = {
  text: string                          // de-identified output
  mapping: Record<string, string>       // token -> original
  identifiersFound: number              // count, for audit
}