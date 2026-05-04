export type AccessType = 
    | 'read'
    | 'write'
    | 'update'
    | 'delete'
    | 'export'
    | 'llm_call'

export type ResourceType = 
  | 'patient'
  | 'encounter'
  | 'soap_note'
  | 'vitals'
  | 'prescription'
  | 'lab_result'
  | 'appointment'
  | 'condition'
  | 'allergy'

export type AuditEntry = {
    doctorId?:string
    patientId?:string | null
    accessType: AccessType
    resourceType:ResourceType
    resourceId?: string | null
    metadata?:Record<string,unknown>
}

export type AuditResult = 
    | { ok:true }
    | { ok:false; error: string}
