import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PassengerDetailClientFull from './PassengerDetailClientFull'

async function getPassenger(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('passengers')
    .select('*, schools(name), routes(route_number)')
    .eq('id', id)
    .single()

  if (error || !data) return null
  return data
}

async function getPassengerIncidents(passengerId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('incident_passengers')
    .select(`
      *,
      incidents (
        id,
        incident_type,
        description,
        reported_at,
        resolved,
        vehicles (
          vehicle_identifier
        ),
        routes (
          route_number
        )
      )
    `)
    .eq('passenger_id', passengerId)
    .order('incidents(reported_at)', { ascending: false })

  if (error) {
    console.error('Error fetching passenger incidents:', error)
    return []
  }

  return data || []
}

async function getParentContacts(passengerId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('passenger_parent_contacts')
    .select('*, parent_contacts(*)')
    .eq('passenger_id', passengerId)

  if (error) {
    console.error('Error fetching parent contacts:', error)
    return []
  }

  return data || []
}

export default async function ViewPassengerPage({ params }: { params: { id: string } }) {
  const { id } = await params
  const passenger = await getPassenger(id)
  if (!passenger) notFound()

  const incidents = await getPassengerIncidents(id)
  const parentContacts = await getParentContacts(id)

  return (
    <PassengerDetailClientFull
      passenger={passenger}
      incidents={incidents}
      parentContacts={parentContacts}
    />
  )
}
