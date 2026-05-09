/**
 * One-time script to generate 20 MedQA-derived eval cases.
 * Run: npx tsx scripts/build-eval-cases.ts
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
import { writeFileSync } from 'fs'
import { join } from 'path'
import { getLLM } from '../lib/llm'
import type { EvalCase } from '../lib/eval/types'

// MedQA-style stems we'll adapt. Each becomes a doctor-patient transcript.
// Real MedQA dataset is huge — we hand-pick 20 representative stems.
const STEMS = [
  { id: 'medqa-0001', category: 'cardiology', difficulty: 'medium', uncertainty: false,
    stem: '52yo male, hypertension, presents with substernal chest pressure radiating to left arm during exertion, relieved by rest. PMH: HTN, smoker 30 pack-years.',
    diagnoses: ['stable angina', 'coronary artery disease'],
    plan: ['ECG', 'troponin', 'aspirin', 'cardiology referral'],
    redFlags: ['rule out ACS'], ambig: [] },
  { id: 'medqa-0002', category: 'endocrine', difficulty: 'easy', uncertainty: false,
    stem: '45yo female, T2DM, presents with polyuria, polydipsia, fatigue x 2 weeks. HbA1c 11.2. BMI 32.',
    diagnoses: ['uncontrolled type 2 diabetes', 'hyperglycemia'],
    plan: ['adjust metformin', 'add basal insulin', 'diabetes education', 'HbA1c recheck'],
    redFlags: ['DKA screening'], ambig: [] },
  { id: 'medqa-0003', category: 'neurology', difficulty: 'hard', uncertainty: true,
    stem: '68yo male, sudden onset right-sided weakness 90 minutes ago. Speech slurred. BP 180/100. Patient unsure of exact onset time.',
    diagnoses: ['acute ischemic stroke', 'TIA'],
    plan: ['stat CT head', 'neurology consult', 'consider tPA window'],
    redFlags: ['time-sensitive stroke'], ambig: ['exact onset time'] },
  { id: 'medqa-0004', category: 'gi', difficulty: 'medium', uncertainty: false,
    stem: '34yo female, RUQ pain after fatty meals x 6 months, nausea. Murphy sign positive.',
    diagnoses: ['cholelithiasis', 'cholecystitis'],
    plan: ['RUQ ultrasound', 'LFTs', 'surgical consult'],
    redFlags: ['acute cholecystitis'], ambig: [] },
  { id: 'medqa-0005', category: 'pulmonary', difficulty: 'medium', uncertainty: false,
    stem: '28yo female, productive cough x 5 days, fever 38.9, SOB. RR 24, SpO2 92%, crackles right base.',
    diagnoses: ['community-acquired pneumonia'],
    plan: ['chest X-ray', 'CBC', 'antibiotics', 'follow-up 48h'],
    redFlags: ['hypoxemia', 'sepsis screen'], ambig: [] },
  { id: 'medqa-0006', category: 'psychiatry', difficulty: 'hard', uncertainty: true,
    stem: '22yo male, declining academic performance, social withdrawal x 4 months. Patient reports hearing voices but denies harm intent. Family unsure of timeline.',
    diagnoses: ['first-episode psychosis', 'schizophreniform'],
    plan: ['psych referral', 'rule out substance', 'family education'],
    redFlags: ['safety assessment'], ambig: ['symptom onset', 'family history'] },
  { id: 'medqa-0007', category: 'infectious', difficulty: 'easy', uncertainty: false,
    stem: '8yo child, sore throat 3 days, fever 39, tonsillar exudates, cervical lymphadenopathy. Rapid strep positive.',
    diagnoses: ['streptococcal pharyngitis'],
    plan: ['amoxicillin 10 days', 'symptomatic care', 'school exclusion 24h'],
    redFlags: ['rheumatic fever prevention'], ambig: [] },
  { id: 'medqa-0008', category: 'renal', difficulty: 'hard', uncertainty: false,
    stem: '70yo male, decreased urine output 2 days, leg edema, SOB. Cr 3.4 (baseline 1.1), K 5.8. Recent NSAID use.',
    diagnoses: ['acute kidney injury', 'NSAID-induced AKI'],
    plan: ['stop NSAIDs', 'IV fluids', 'nephrology consult', 'monitor K'],
    redFlags: ['hyperkalemia', 'volume status'], ambig: [] },
  { id: 'medqa-0009', category: 'cardiology', difficulty: 'easy', uncertainty: false,
    stem: '60yo female, palpitations 2 hours, irregular pulse 130. No chest pain. ECG shows AF with RVR.',
    diagnoses: ['atrial fibrillation', 'rapid ventricular response'],
    plan: ['rate control', 'anticoagulation assessment', 'CHA2DS2-VASc'],
    redFlags: ['stroke risk', 'hemodynamic stability'], ambig: [] },
  { id: 'medqa-0010', category: 'endocrine', difficulty: 'medium', uncertainty: true,
    stem: '38yo female, fatigue, weight gain 8kg, cold intolerance, constipation. TSH pending. Family history of thyroid disease unclear.',
    diagnoses: ['hypothyroidism', 'Hashimotos'],
    plan: ['TSH', 'free T4', 'TPO antibodies', 'levothyroxine if confirmed'],
    redFlags: ['myxedema'], ambig: ['family history', 'symptom duration'] },
  { id: 'medqa-0011', category: 'gi', difficulty: 'medium', uncertainty: false,
    stem: '50yo male, dark stools x 1 week, fatigue. Hb 8.2, MCV 72. PMH: chronic NSAID use for arthritis.',
    diagnoses: ['upper GI bleed', 'iron deficiency anemia'],
    plan: ['EGD', 'PPI', 'stop NSAIDs', 'iron supplementation'],
    redFlags: ['hemodynamic stability', 'malignancy screening'], ambig: [] },
  { id: 'medqa-0012', category: 'neurology', difficulty: 'medium', uncertainty: false,
    stem: '40yo female, severe unilateral throbbing headache with photophobia and nausea x 6h. Similar episodes monthly. Aura preceded by visual scotoma.',
    diagnoses: ['migraine with aura'],
    plan: ['triptan acute', 'avoid triggers', 'consider prophylaxis', 'headache diary'],
    redFlags: ['rule out SAH'], ambig: [] },
  { id: 'medqa-0013', category: 'pulmonary', difficulty: 'hard', uncertainty: true,
    stem: '65yo smoker, chronic cough, weight loss 6kg/3 months, hemoptysis x 1 week. Smoking history unclear; patient minimizes.',
    diagnoses: ['lung cancer', 'malignancy'],
    plan: ['CT chest', 'pulmonology referral', 'PFTs', 'staging workup'],
    redFlags: ['malignancy', 'metastasis screening'], ambig: ['smoking history'] },
  { id: 'medqa-0014', category: 'rheumatology', difficulty: 'medium', uncertainty: false,
    stem: '55yo female, symmetric joint pain in MCPs and wrists x 4 months, morning stiffness >1h. RF and anti-CCP positive.',
    diagnoses: ['rheumatoid arthritis'],
    plan: ['rheumatology referral', 'methotrexate', 'X-rays', 'baseline labs'],
    redFlags: ['joint damage'], ambig: [] },
  { id: 'medqa-0015', category: 'pediatric', difficulty: 'easy', uncertainty: false,
    stem: '4yo, ear pain 2 days, fever 38.5, irritable. TM red and bulging on right. No drainage.',
    diagnoses: ['acute otitis media'],
    plan: ['amoxicillin', 'analgesia', 'follow-up 48-72h', 'fluid intake'],
    redFlags: ['mastoiditis'], ambig: [] },
  { id: 'medqa-0016', category: 'cardiology', difficulty: 'hard', uncertainty: true,
    stem: '75yo male, syncope at home today. No prodrome. ECG sinus rhythm. Witnessed convulsions per family but unclear duration.',
    diagnoses: ['cardiac syncope', 'arrhythmia', 'rule out seizure'],
    plan: ['admit telemetry', 'echo', 'orthostatics', 'EEG if seizure suspected'],
    redFlags: ['arrhythmia', 'structural heart disease'], ambig: ['convulsion details'] },
  { id: 'medqa-0017', category: 'infectious', difficulty: 'medium', uncertainty: false,
    stem: '30yo female, dysuria, urgency, suprapubic pain x 2 days. No fever, no flank pain. UA: leuks +, nitrites +.',
    diagnoses: ['uncomplicated UTI'],
    plan: ['nitrofurantoin', 'increase fluids', 'follow-up if symptoms persist'],
    redFlags: ['pyelonephritis'], ambig: [] },
  { id: 'medqa-0018', category: 'endocrine', difficulty: 'hard', uncertainty: false,
    stem: '25yo female, T1DM, presenting with vomiting, abdominal pain, deep rapid breathing. Glucose 480, ketones 4+, pH 7.21.',
    diagnoses: ['diabetic ketoacidosis'],
    plan: ['IV fluids', 'insulin drip', 'electrolyte monitoring', 'identify trigger'],
    redFlags: ['cerebral edema', 'hypokalemia'], ambig: [] },
  { id: 'medqa-0019', category: 'gi', difficulty: 'easy', uncertainty: false,
    stem: '29yo male, lower abdominal pain migrated to RLQ x 12 hours, anorexia, low-grade fever. McBurney point tender. WBC 14.',
    diagnoses: ['acute appendicitis'],
    plan: ['surgical consult', 'CT abdomen', 'NPO', 'IV fluids', 'antibiotics'],
    redFlags: ['perforation'], ambig: [] },
  { id: 'medqa-0020', category: 'neurology', difficulty: 'medium', uncertainty: true,
    stem: '55yo male, progressive memory loss x 1 year per spouse. Patient denies. MoCA 22/30. No focal deficits.',
    diagnoses: ['mild cognitive impairment', 'early dementia'],
    plan: ['cognitive workup', 'B12/TSH', 'MRI brain', 'neuropsych eval'],
    redFlags: ['reversible causes'], ambig: ['onset', 'patient awareness'] },
] as const

const ADAPTER_PROMPT = `Convert this clinical case stem into a realistic doctor-patient encounter transcript (150-300 words).

Format:
- First-person doctor narration documenting the encounter
- Include patient's reported symptoms, relevant history, vitals
- Use clinical language appropriate for SOAP note generation
- Include the patient's name as "Patient {NAME}" using the provided name
- DO NOT include the diagnosis or treatment plan in the transcript — those are what the SOAP must produce
- For uncertainty-flagged cases, preserve ambiguity (don't resolve it)

Output ONLY the transcript. No preamble, no labels.`

const PATIENT_NAMES = [
  'Arjun Sharma', 'Priya Verma', 'Rahul Kumar', 'Sneha Iyer', 'Vikram Singh',
  'Anjali Patel', 'Karthik Reddy', 'Meera Nair', 'Rohan Das', 'Divya Menon',
  'Aditya Rao', 'Kavya Joshi', 'Manish Gupta', 'Pooja Bhatt', 'Suresh Pillai',
  'Nisha Kapoor', 'Tarun Mehta', 'Lakshmi Krishnan', 'Harsh Agarwal', 'Riya Saxena',
]

async function main() {
  const llm = getLLM()
  const cases: EvalCase[] = []

  for (let i = 0; i < STEMS.length; i++) {
    const s = STEMS[i]
    const name = PATIENT_NAMES[i]
    console.log(`Adapting ${s.id} (${i + 1}/${STEMS.length})...`)

    const userMsg = `Case stem: ${s.stem}\n\nPatient name: ${name}\n\nGenerate the transcript.`
    const res = await llm.generate(
      [{ role: 'user', content: userMsg }],
      {
        model: 'gemini-2.5-flash',
        systemPrompt: ADAPTER_PROMPT,
        temperature: 0.4,
        maxTokens: 2000,
        thinkingBudget: 0,
      }
    )

    cases.push({
      id: s.id,
      source: 'medqa',
      category: s.category,
      difficulty: s.difficulty,
      uncertaintyInjected: s.uncertainty,
      transcript: res.content.trim(),
      patientContext: { name },
      expectedDiagnoses: [...s.diagnoses],
      expectedPlanItems: [...s.plan],
      redFlags: [...s.redFlags],
      knownAmbiguities: [...s.ambig],
    })

    // Rate-limit guard: 5 RPM on free tier
    await new Promise((r) => setTimeout(r, 13000))
  }

  const outPath = join(process.cwd(), 'data', 'eval-cases.json')
  writeFileSync(outPath, JSON.stringify(cases, null, 2))
  console.log(`\nWrote ${cases.length} cases to ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})