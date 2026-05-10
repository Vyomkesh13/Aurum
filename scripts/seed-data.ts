/**
 * One-time seeder.
 * Inserts 5 hand-curated showcase patients + 10 randomly-generated patients
 * for the doctor identified by SEED_DOCTOR_EMAIL or the only doctor in profiles.
 *
 * Run: npx tsx scripts/seed-data.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { readFileSync } from 'fs'
import { join } from 'path'
import { createClient } from '@supabase/supabase-js'
import { faker } from '@faker-js/faker'

type Vitals = {
  systolic_bp?: number
  diastolic_bp?: number
  heart_rate?: number
  respiratory_rate?: number
  temperature_celsius?: number
  spo2?: number
  weight_kg?: number
  height_cm?: number
}

type SeedPatient = {
  full_name: string
  date_of_birth: string
  gender: 'male' | 'female' | 'other'
  phone: string
  blood_type: string
  allergies: string[]
  archetype: string
  conditions: Array<{
    condition_name: string
    icd10_code?: string
    status: string
    severity?: string
    onset_date?: string
  }>
  encounters: Array<{
    type: string
    complaint: string
    days_ago: number
    vitals: Vitals
  }>
  prescriptions: Array<{
    medication: string
    dosage: string
    frequency: string
    status: string
  }>
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  // 1. Find the doctor to seed for
  const { data: profiles, error: profileErr } = await supabase
    .from('profiles')
    .select('id, full_name')
    .limit(2)

  if (profileErr || !profiles || profiles.length === 0) {
    console.error('No doctor profile found. Sign up first.')
    process.exit(1)
  }
  const doctorId = profiles[0].id
  console.log(`Seeding for doctor: ${profiles[0].full_name} (${doctorId})\n`)

  // 2. Wipe existing patient-related rows for this doctor
  console.log('Clearing existing data for this doctor...')
  await supabase.from('vitals').delete().eq('doctor_id', doctorId)
  await supabase.from('encounters').delete().eq('doctor_id', doctorId)
  await supabase.from('prescriptions').delete().eq('doctor_id', doctorId)
  await supabase.from('conditions').delete().eq('doctor_id', doctorId)
  await supabase.from('patients').delete().eq('doctor_id', doctorId)

  // 3. Load hand-curated patients
  const handCurated: SeedPatient[] = JSON.parse(
    readFileSync(join(process.cwd(), 'data', 'seed-patients.json'), 'utf-8')
  )

  // 4. Generate 10 additional Faker patients
  const generated: SeedPatient[] = Array.from({ length: 10 }, (_, i) =>
    generateFakePatient(i)
  )

  const allPatients = [...handCurated, ...generated]

  // 5. Insert each patient with all related rows
  for (const p of allPatients) {
    await insertPatient(doctorId, p)
  }

  console.log(`\n✓ Seeded ${allPatients.length} patients`)
}

async function insertPatient(doctorId: string, p: SeedPatient) {
  const { data: patient, error } = await supabase
    .from('patients')
    .insert({
      doctor_id: doctorId,
      full_name: p.full_name,
      date_of_birth: p.date_of_birth,
      gender: p.gender,
      phone: p.phone,
      blood_type: p.blood_type,
      allergies: p.allergies,
    })
    .select()
    .single()

  if (error || !patient) {
    console.error(`  ✗ ${p.full_name}: ${error?.message}`)
    return
  }

  // Conditions
  if (p.conditions.length > 0) {
    const conditionsRows = p.conditions.map((c) => ({
      patient_id: patient.id,
      doctor_id: doctorId,
      condition_name: c.condition_name,
      icd10_code: c.icd10_code,
      status: c.status,
      severity: c.severity,
      onset_date: c.onset_date,
    }))
    await supabase.from('conditions').insert(conditionsRows)
  }

  // Encounters + vitals
  for (const enc of p.encounters) {
    const startedAt = new Date()
    startedAt.setDate(startedAt.getDate() - enc.days_ago)
    const endedAt = new Date(startedAt.getTime() + 30 * 60 * 1000)

    const { data: encounter } = await supabase
      .from('encounters')
      .insert({
        patient_id: patient.id,
        doctor_id: doctorId,
        encounter_type: enc.type,
        chief_complaint: enc.complaint,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        status: 'completed',
      })
      .select()
      .single()

    if (encounter && Object.keys(enc.vitals).length > 0) {
      await supabase.from('vitals').insert({
        encounter_id: encounter.id,
        patient_id: patient.id,
        doctor_id: doctorId,
        ...enc.vitals,
        recorded_at: startedAt.toISOString(),
      })
    }
  }

  // Prescriptions
  if (p.prescriptions.length > 0) {
    const presc = p.prescriptions.map((rx) => ({
      patient_id: patient.id,
      doctor_id: doctorId,
      medication: rx.medication,
      dosage: rx.dosage,
      frequency: rx.frequency,
      status: rx.status,
    }))
    await supabase.from('prescriptions').insert(presc)
  }

  console.log(`  ✓ ${p.full_name} (${p.archetype ?? 'random'})`)
}

const ARCHETYPES = [
  { complaint: 'Annual physical examination', conditions: [] },
  { complaint: 'Lower back pain x 2 weeks', conditions: [{ condition_name: 'Mechanical low back pain', icd10_code: 'M54.5' }] },
  { complaint: 'Migraine headaches', conditions: [{ condition_name: 'Migraine without aura', icd10_code: 'G43.009' }] },
  { complaint: 'Seasonal allergies', conditions: [{ condition_name: 'Allergic rhinitis', icd10_code: 'J30.9' }] },
  { complaint: 'Routine pregnancy follow-up', conditions: [{ condition_name: 'Normal pregnancy', icd10_code: 'Z34.90' }] },
  { complaint: 'Acid reflux', conditions: [{ condition_name: 'GERD', icd10_code: 'K21.9' }] },
  { complaint: 'Sleep difficulties', conditions: [{ condition_name: 'Insomnia disorder', icd10_code: 'G47.00' }] },
  { complaint: 'Anxiety symptoms', conditions: [{ condition_name: 'Generalized anxiety disorder', icd10_code: 'F41.1' }] },
  { complaint: 'Knee pain after fall', conditions: [{ condition_name: 'Knee sprain', icd10_code: 'S83.91XA' }] },
  { complaint: 'Skin rash', conditions: [{ condition_name: 'Contact dermatitis', icd10_code: 'L25.9' }] },
]

function generateFakePatient(idx: number): SeedPatient {
  const sex = faker.helpers.arrayElement(['male', 'female']) as 'male' | 'female'
  const arch = ARCHETYPES[idx % ARCHETYPES.length]
  const dobYearsAgo = faker.number.int({ min: 18, max: 75 })
  const daysAgo = faker.number.int({ min: 1, max: 180 })
  const dob = new Date()
  dob.setFullYear(dob.getFullYear() - dobYearsAgo)

  return {
    full_name: faker.person.fullName({ sex }),
    date_of_birth: dob.toISOString().slice(0, 10),
    gender: sex,
    phone: '+91 ' + faker.string.numeric(5) + ' ' + faker.string.numeric(5),
    blood_type: faker.helpers.arrayElement(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
    allergies: faker.helpers.arrayElements(
      ['Penicillin', 'Sulfa drugs', 'Peanuts', 'Latex', 'Shellfish', 'Aspirin'],
      { min: 0, max: 2 }
    ),
    archetype: arch.complaint,
    conditions: arch.conditions.map((c) => ({
      ...c,
      status: 'active',
      severity: 'mild',
    })),
    encounters: [
      {
        type: faker.helpers.arrayElement(['in_person', 'telehealth', 'follow_up']),
        complaint: arch.complaint,
        days_ago: daysAgo,
        vitals: {
          systolic_bp: faker.number.int({ min: 105, max: 145 }),
          diastolic_bp: faker.number.int({ min: 65, max: 92 }),
          heart_rate: faker.number.int({ min: 60, max: 95 }),
          spo2: faker.number.int({ min: 95, max: 100 }),
          weight_kg: faker.number.float({ min: 50, max: 95, fractionDigits: 1 }),
          height_cm: faker.number.int({ min: 150, max: 185 }),
        },
      },
    ],
    prescriptions: [],
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})