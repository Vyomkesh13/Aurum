import type { IdentifierType } from './types'

export type PatternRule = {
  type: IdentifierType
  regex: RegExp
}

export const PATTERNS: PatternRule[] = [
  // Email — well-defined RFC-ish shape
  {
    type: 'EMAIL',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },

  // URL
  {
    type: 'URL',
    regex: /\bhttps?:\/\/[^\s<>"]+/gi,
  },

  // IPv4
  {
    type: 'IP',
    regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  },

  // SSN — US format XXX-XX-XXXX
  {
    type: 'SSN',
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
  },

  // MRN — common shapes: "MRN: 12345", "MRN-12345", "MR#12345"
  {
    type: 'MRN',
    regex: /\bMR(?:N)?[\s:#-]*\d{4,10}\b/gi,
  },

  // Phone — international + Indian + US common forms
  // Matches: +91 98765 43210, +1-555-555-5555, (555) 555-5555, 555-555-5555
  {
    type: 'PHONE',
    regex: /(?:\+\d{1,3}[\s-]?)?(?:\(\d{2,4}\)[\s-]?|\d{2,4}[\s-]?)\d{3,4}[\s-]?\d{3,5}/g,
  },

  // ISO date — YYYY-MM-DD
  {
    type: 'DATE',
    regex: /\b\d{4}-\d{2}-\d{2}\b/g,
  },

  // Slash date — DD/MM/YYYY or MM/DD/YYYY
  {
    type: 'DATE',
    regex: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
  },

  // Written date — "March 15, 1985" / "15 March 1985"
  {
    type: 'DATE',
    regex: /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{2,4})?\b/gi,
  },
  {
    type: 'DATE',
    regex: /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?(?:\s+\d{2,4})?\b/gi,
  },

  // Generic long ID — 8+ digit numeric strings (often record numbers, account #s)
  // Run last because it's the broadest. Catches Safe Harbor #18 catch-all.
  {
    type: 'ID',
    regex: /\b\d{8,}\b/g,
  },
]