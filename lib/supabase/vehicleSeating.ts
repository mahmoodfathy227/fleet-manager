// ====================================================
// Vehicle Seating Plan Helper Functions
// ====================================================

import { createClient } from '@/lib/supabase/server'
import { 
  VehicleSeatingPlan, 
  SeatingPlanInput, 
  SubstitutionVehicle 
} from '@/lib/types'

/**
 * Get the active seating plan for a specific vehicle
 */
export async function getVehicleSeatingPlan(
  vehicleId: string
): Promise<VehicleSeatingPlan | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vehicle_seating_plans')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('Error fetching seating plan:', error)
    return null
  }

  return data ?? null
}

/**
 * Get all seating plans (including inactive) for a vehicle
 */
export async function getVehicleSeatingPlanHistory(
  vehicleId: string
): Promise<VehicleSeatingPlan[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('vehicle_seating_plans')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching seating plan history:', error)
    return []
  }

  return data || []
}

/**
 * Update or create a new seating plan for a vehicle using RPC
 * This will deactivate the old plan and create a new active one
 */
export async function updateSeatingPlan(
  vehicleId: string,
  planData: SeatingPlanInput
): Promise<{ success: boolean; data?: VehicleSeatingPlan; error?: string }> {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase.rpc('update_vehicle_seating_plan', {
      p_vehicle_id: vehicleId,
      p_name: planData.name,
      p_total_capacity: planData.total_capacity,
      p_rows: planData.rows,
      p_seats_per_row: planData.seats_per_row,
      p_wheelchair_spaces: planData.wheelchair_spaces,
      p_notes: planData.notes || null
    })

    if (error) {
      console.error('Error updating seating plan:', error)
      return { 
        success: false, 
        error: error.message || 'Failed to update seating plan' 
      }
    }

    return { success: true, data }
  } catch (err) {
    console.error('Exception updating seating plan:', err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error occurred' 
    }
  }
}

/**
 * Find available substitute vehicles with matching seating configuration
 */
export async function findSubstitutionVehicles(
  vehicleId: string
): Promise<{ success: boolean; data?: SubstitutionVehicle[]; error?: string }> {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase.rpc('find_substitution_vehicles', {
      p_vehicle_id: vehicleId
    })

    if (error) {
      console.error('Error finding substitution vehicles:', error)
      return { 
        success: false, 
        error: error.message || 'Failed to find substitution vehicles' 
      }
    }

    return { success: true, data: data || [] }
  } catch (err) {
    console.error('Exception finding substitution vehicles:', err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error occurred' 
    }
  }
}

/**
 * Check if a vehicle has an active seating plan
 */
export async function vehicleHasSeatingPlan(
  vehicleId: string
): Promise<boolean> {
  const plan = await getVehicleSeatingPlan(vehicleId)
  return plan !== null
}

/**
 * Deactivate a seating plan (typically not called directly, use updateSeatingPlan instead)
 */
export async function deactivateSeatingPlan(
  planId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('vehicle_seating_plans')
    .update({ is_active: false })
    .eq('id', planId)

  if (error) {
    console.error('Error deactivating seating plan:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

