import type { SupabaseClient } from '@supabase/supabase-js'

export function vehicleLabelFromRow(v: {
  id: number
  registration?: string | null
  vehicle_identifier?: string | null
}): string {
  const reg = String(v.registration ?? '').trim()
  const ident = String(v.vehicle_identifier ?? '').trim()
  return reg || ident || `Vehicle #${v.id}`
}

export async function fetchVehicleDisplayLabelMap(
  supabase: SupabaseClient,
  vehicleIds: number[]
): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  const unique = Array.from(new Set(vehicleIds)).filter((id) => Number.isFinite(id) && id > 0)
  if (unique.length === 0) return map
  const { data, error } = await supabase
    .from('vehicles')
    .select('id, registration, vehicle_identifier')
    .in('id', unique)
  if (error) {
    console.error('[fleet] fetchVehicleDisplayLabelMap', error.message)
    return map
  }
  for (const v of data || []) {
    map.set(v.id as number, vehicleLabelFromRow(v as { id: number; registration?: string | null; vehicle_identifier?: string | null }))
  }
  console.debug('[fleet] fetchVehicleDisplayLabelMap', map.size, 'labels for', unique.length, 'ids')
  return map
}

export type EntityDisplayRow = {
  entity_type?: string | null
  entity_id?: number | null
  recipient?: { full_name?: string | null } | null
  entity_display_label?: string | null
}

export function computeEntityDisplayLabel(r: EntityDisplayRow, vehicleById: Map<number, string>): string {
  const et = String(r.entity_type || '').toLowerCase()
  const eid = typeof r.entity_id === 'number' ? r.entity_id : null
  if (et === 'vehicle' && eid != null) {
    return vehicleById.get(eid) ?? `Vehicle #${eid}`
  }
  if (et === 'driver' || et === 'assistant') {
    const name = r.recipient?.full_name?.trim()
    return name || (eid != null ? `Staff #${eid}` : 'Staff')
  }
  return r.recipient?.full_name?.trim() || '—'
}

export async function withEntityDisplayLabels<T extends EntityDisplayRow>(
  supabase: SupabaseClient,
  rows: T[]
): Promise<(T & { entity_display_label: string })[]> {
  const vehicleIds = rows
    .filter((r) => String(r.entity_type || '').toLowerCase() === 'vehicle' && typeof r.entity_id === 'number')
    .map((r) => r.entity_id as number)
  const vehicleMap = await fetchVehicleDisplayLabelMap(supabase, vehicleIds)
  console.debug('[fleet] withEntityDisplayLabels', rows.length, 'rows,', vehicleMap.size, 'vehicle labels')
  return rows.map((r) => ({
    ...r,
    entity_display_label: computeEntityDisplayLabel(r, vehicleMap),
  }))
}
