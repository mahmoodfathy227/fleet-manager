/**
 * Compliance → Vehicles → Calendar: doc_type to vehicle expiry column mapping
 * and expiry status helpers. Used by API and UI.
 * Checks use: (1) dynamic vehicle requirements (subject_documents), (2) existing vehicle create fields.
 */

/** Doc type / display name → vehicle table column (existing in vehicle create) */
export const DOC_TYPE_TO_VEHICLE_EXPIRY: Record<string, string> = {
  'Vehicle Plate Certificate': 'registration_expiry_date',
  'Vehicle Insurance Certificate': 'insurance_expiry_date',
  'MOT Certificate': 'mot_date',
  'Vehicle Tax Certificate': 'tax_date',
  'LOLER Certificate': 'loler_expiry_date',
  'First Aid Kit Certificate': 'first_aid_expiry',
  'Fire Extinguisher Certificate': 'fire_extinguisher_expiry',
  'Vehicle Plate': 'registration_expiry_date',
  'Vehicle Registration/Plate Certificate': 'registration_expiry_date',
  'Insurance': 'insurance_expiry_date',
  'MOT': 'mot_date',
  'Tax': 'tax_date',
  'LOLER': 'loler_expiry_date',
  'First Aid': 'first_aid_expiry',
  'Fire Extinguisher': 'fire_extinguisher_expiry',
  'Plate Expiry': 'registration_expiry_date',
}

/** Vehicle table expiry columns used in vehicle create and certificates-expiry (label for display) */
export const VEHICLE_EXPIRY_COLUMNS: { key: string; label: string }[] = [
  { key: 'registration_expiry_date', label: 'Plate / Registration' },
  { key: 'plate_expiry_date', label: 'Plate Expiry' },
  { key: 'insurance_expiry_date', label: 'Insurance' },
  { key: 'mot_date', label: 'MOT' },
  { key: 'tax_date', label: 'Tax' },
  { key: 'loler_expiry_date', label: 'LOLER' },
  { key: 'first_aid_expiry', label: 'First Aid' },
  { key: 'fire_extinguisher_expiry', label: 'Fire Extinguisher' },
]

const DEFAULT_TOLERANCE_DAYS = 14

export type ExpiryStatus = 'ok' | 'expiring_soon' | 'expired'

export function getExpiryStatus(
  expiryDate: string | null,
  toleranceDays: number = DEFAULT_TOLERANCE_DAYS
): ExpiryStatus | null {
  if (!expiryDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'expired'
  if (diffDays <= toleranceDays) return 'expiring_soon'
  return 'ok'
}

export function getDaysRemaining(expiryDate: string | null): number | null {
  if (!expiryDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

/** Resolve vehicle expiry date for a document from vehicle record by doc_type */
export function getVehicleExpiryForDocType(
  vehicle: Record<string, unknown>,
  docType: string | null
): string | null {
  if (!docType || !vehicle) return null
  const key = DOC_TYPE_TO_VEHICLE_EXPIRY[docType] ?? DOC_TYPE_TO_VEHICLE_EXPIRY[docType.trim()]
  if (!key) return null
  const val = vehicle[key]
  if (val == null) return null
  if (typeof val === 'string') return val
  if (typeof val === 'object' && typeof (val as Date).toISOString === 'function') return (val as Date).toISOString().slice(0, 10)
  return String(val)
}

/** Get all expiry dates from a vehicle record (existing vehicle create fields) for calendar events */
export function getVehicleExpiryDates(vehicle: Record<string, unknown>): { key: string; label: string; date: string }[] {
  const out: { key: string; label: string; date: string }[] = []
  for (const { key, label } of VEHICLE_EXPIRY_COLUMNS) {
    const val = vehicle[key]
    if (val == null) continue
    let dateStr: string
    if (typeof val === 'string') dateStr = val.slice(0, 10)
    else if (typeof val === 'object' && typeof (val as Date).toISOString === 'function') dateStr = (val as Date).toISOString().slice(0, 10)
    else dateStr = String(val).slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) out.push({ key, label, date: dateStr })
  }
  return out
}

export { DEFAULT_TOLERANCE_DAYS }
