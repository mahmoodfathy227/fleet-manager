import { createClient } from '@/lib/supabase/server'
import { Vehicle } from '@/lib/types'

export interface VehicleFilters {
  search?: string
  is_spare?: 'all' | 'yes' | 'no'
  is_vor?: 'all' | 'yes' | 'no'
  has_lift?: 'all' | 'yes' | 'no'
}

export async function getVehicles(filters: VehicleFilters = {}): Promise<Vehicle[]> {
  const supabase = await createClient()
  
  let query = supabase
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false })

  // Apply search filter (case-insensitive registration search)
  if (filters.search && filters.search.trim()) {
    const searchTerm = filters.search.trim().toLowerCase()
    query = query.ilike('registration', `%${searchTerm}%`)
  }

  // Apply boolean filters
  if (filters.is_spare === 'yes') {
    query = query.eq('spare_vehicle', true)
  } else if (filters.is_spare === 'no') {
    query = query.or('spare_vehicle.is.null,spare_vehicle.eq.false')
  }

  if (filters.is_vor === 'yes') {
    query = query.eq('off_the_road', true)
  } else if (filters.is_vor === 'no') {
    query = query.or('off_the_road.is.null,off_the_road.eq.false')
  }

  if (filters.has_lift === 'yes') {
    query = query.eq('tail_lift', true)
  } else if (filters.has_lift === 'no') {
    query = query.or('tail_lift.is.null,tail_lift.eq.false')
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching vehicles:', error)
    return []
  }

  return data || []
}

