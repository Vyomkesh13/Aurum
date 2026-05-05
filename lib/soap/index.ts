/**
 * SOAP pipeline entry point.
 *
 * Usage:
 *   import { runSoapPipeline } from '@/lib/soap'
 *   const result = await runSoapPipeline({ transcript, patient, patientId })
 */

export { runSoapPipeline } from './pipeline'
export type {
  SoapInput,
  SoapNote,
  CritiqueScores,
  SoapResult,
} from './types'