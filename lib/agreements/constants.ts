/** Agreement `type` values — must match DB CHECK on `agreements.type` (migration 178). */
export const AGREEMENT_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'terms_of_service', label: 'Terms of service' },
  { value: 'privacy_policy', label: 'Privacy policy' },
  { value: 'operational_notice', label: 'Operational notice' },
  { value: 'data_protection', label: 'Data protection' },
] as const

/** `target_roles` array entries — must match `publish_agreement` / role resolution in DB. */
export const TARGET_ROLE_OPTIONS = [
  { value: 'parent', label: 'Parent' },
  { value: 'driver', label: 'Driver' },
  { value: 'passenger_assistant', label: 'Passenger assistant' },
] as const

export type AgreementType = (typeof AGREEMENT_TYPES)[number]['value']

export function labelForAgreementType(type: string): string {
  const row = AGREEMENT_TYPES.find((t) => t.value === type)
  return row?.label ?? type
}

export function labelForTargetRole(role: string): string {
  const row = TARGET_ROLE_OPTIONS.find((r) => r.value === role)
  return row?.label ?? role
}
