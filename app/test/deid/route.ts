import { NextResponse } from 'next/server'
import { deidentify, reidentify } from '@/lib/deidentify'

export async function GET() {
  // Synthetic test input.
  const transcript =
    'Raj Patel, DOB 1985-03-15, MRN: 47829, called 9876543210 about chest pain. ' +
    'Said he saw Dr. Mehta on 2024-04-10. Email r.patel@example.com. ' +
    'Visit website https://example.com/portal for follow-up.'

  const patientContext = {
    name: 'Raj Patel',
    dateOfBirth: '1985-03-15',
    phone: '9876543210',
    mrn: '47829',
  }

  // Step 1: de-identify
  const deid = deidentify(transcript, patientContext)

  // Step 2: simulate an LLM response that uses the tokens
  const fakeLlmOutput =
    '<NAME_1> presents with chest pain. DOB <DATE_1>. ' +
    'Visit on <DATE_2> noted. Schedule follow-up.'

  // Step 3: re-identify
  const reidentified = reidentify(fakeLlmOutput, deid.mapping)

  return NextResponse.json({
    ok: true,
    original: transcript,
    deidentified: deid.text,
    mapping: deid.mapping,
    identifiersFound: deid.identifiersFound,
    fakeLlmOutput,
    reidentified,
  })
}