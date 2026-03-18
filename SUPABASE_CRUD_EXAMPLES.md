# Supabase CRUD Query Examples

## 📖 Quick Reference Guide for Fleet Management System

---

## Passenger Updates

### Create
```typescript
// Add a new update for a passenger
const { data, error } = await supabase
  .from('passenger_updates')
  .insert([{
    passenger_id: 123,
    update_text: 'Passenger now requires wheelchair access',
    updated_by: userId // Optional, can be null
  }])
  .select()
  .single()
```

### Read
```typescript
// Get all updates for a specific passenger
const { data, error } = await supabase
  .from('passenger_updates')
  .select(`
    *,
    users (
      id,
      email
    )
  `)
  .eq('passenger_id', 123)
  .order('created_at', { ascending: false })

// Get single update by ID
const { data, error } = await supabase
  .from('passenger_updates')
  .select('*')
  .eq('id', 456)
  .single()
```

### Update
```typescript
// Update existing passenger update
const { data, error } = await supabase
  .from('passenger_updates')
  .update({
    update_text: 'Updated text content'
  })
  .eq('id', 456)
  .select()
```

### Delete
```typescript
// Delete a passenger update
const { error } = await supabase
  .from('passenger_updates')
  .delete()
  .eq('id', 456)
```

---

## Passenger Parent Contacts

### Create
```typescript
// Link existing parent contact to passenger
const { data, error } = await supabase
  .from('passenger_parent_contacts')
  .insert([{
    passenger_id: 123,
    parent_contact_id: 789
  }])
  .select()

// Create new parent contact and link in one transaction
const { data: newContact, error: contactError } = await supabase
  .from('parent_contacts')
  .insert([{
    full_name: 'Jane Smith',
    relationship: 'Mother',
    phone_number: '555-0123',
    email: 'jane@example.com',
    address: '123 Main St'
  }])
  .select()
  .single()

if (!contactError && newContact) {
  const { data: link, error: linkError } = await supabase
    .from('passenger_parent_contacts')
    .insert([{
      passenger_id: 123,
      parent_contact_id: newContact.id
    }])
}
```

### Read
```typescript
// Get all parent contacts for a passenger
const { data, error } = await supabase
  .from('passenger_parent_contacts')
  .select(`
    *,
    parent_contacts (
      id,
      full_name,
      relationship,
      phone_number,
      email,
      address
    )
  `)
  .eq('passenger_id', 123)

// Get all passengers for a parent contact
const { data, error } = await supabase
  .from('passenger_parent_contacts')
  .select(`
    *,
    passengers (
      id,
      full_name,
      dob,
      schools (
        name
      )
    )
  `)
  .eq('parent_contact_id', 789)
```

### Update
```typescript
// Update parent contact information
const { data, error } = await supabase
  .from('parent_contacts')
  .update({
    phone_number: '555-9999',
    email: 'newemail@example.com'
  })
  .eq('id', 789)
  .select()
```

### Delete
```typescript
// Unlink parent contact from passenger
const { error } = await supabase
  .from('passenger_parent_contacts')
  .delete()
  .eq('id', linkId)

// Delete parent contact entirely (removes all links due to CASCADE)
const { error } = await supabase
  .from('parent_contacts')
  .delete()
  .eq('id', 789)
```

---

## Incidents with Relations

### Create
```typescript
// Create incident with multiple employees and passengers
const { data: incident, error: incidentError } = await supabase
  .from('incidents')
  .insert([{
    incident_type: 'Accident',
    description: 'Minor collision at pickup point',
    vehicle_id: 42,
    route_id: 15,
    resolved: false
  }])
  .select()
  .single()

if (!incidentError && incident) {
  // Link multiple employees
  const employeeLinks = [101, 102, 103].map(empId => ({
    incident_id: incident.id,
    employee_id: empId
  }))
  
  await supabase
    .from('incident_employees')
    .insert(employeeLinks)

  // Link multiple passengers
  const passengerLinks = [201, 202].map(passId => ({
    incident_id: incident.id,
    passenger_id: passId
  }))
  
  await supabase
    .from('incident_passengers')
    .insert(passengerLinks)
}
```

### Read
```typescript
// Get incident with all related entities
const { data, error } = await supabase
  .from('incidents')
  .select(`
    *,
    vehicles (
      id,
      vehicle_identifier,
      make,
      model
    ),
    routes (
      id,
      route_number
    )
  `)
  .eq('id', incidentId)
  .single()

// Get related employees for incident
const { data: employees, error: empError } = await supabase
  .from('incident_employees')
  .select(`
    *,
    employees (
      id,
      full_name,
      role,
      phone_number
    )
  `)
  .eq('incident_id', incidentId)

// Get related passengers for incident
const { data: passengers, error: passError } = await supabase
  .from('incident_passengers')
  .select(`
    *,
    passengers (
      id,
      full_name,
      schools (
        name
      )
    )
  `)
  .eq('incident_id', incidentId)
```

### Update
```typescript
// Mark incident as resolved
const { data, error } = await supabase
  .from('incidents')
  .update({
    resolved: true
  })
  .eq('id', incidentId)
  .select()

// Add more employees to existing incident
const { error } = await supabase
  .from('incident_employees')
  .insert([{
    incident_id: incidentId,
    employee_id: 104
  }])
```

### Delete
```typescript
// Remove employee from incident
const { error } = await supabase
  .from('incident_employees')
  .delete()
  .eq('id', linkId)

// Remove passenger from incident
const { error } = await supabase
  .from('incident_passengers')
  .delete()
  .eq('id', linkId)

// Delete entire incident (cascades to junction tables)
const { error } = await supabase
  .from('incidents')
  .delete()
  .eq('id', incidentId)
```

---

## Dashboard Statistics

### Incidents This Month
```typescript
const now = new Date()
const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

const { count, error } = await supabase
  .from('incidents')
  .select('*', { count: 'exact', head: true })
  .gte('reported_at', firstDayOfMonth)
```

### Passengers with Parent Links
```typescript
const { data, error } = await supabase
  .from('passenger_parent_contacts')
  .select('passenger_id')

// Count unique passengers
const uniquePassengers = new Set(data?.map(p => p.passenger_id) || []).size
```

### Recent Passenger Updates
```typescript
const { count, data, error } = await supabase
  .from('passenger_updates')
  .select('created_at', { count: 'exact' })
  .order('created_at', { ascending: false })
  .limit(1)

// Total count: count
// Latest timestamp: data[0]?.created_at
```

### Passengers with Update Counts
```typescript
// Get all passengers
const { data: passengers } = await supabase
  .from('passengers')
  .select('*')

// Get all updates
const { data: updates } = await supabase
  .from('passenger_updates')
  .select('passenger_id')

// Map counts
const countsMap = new Map()
updates?.forEach(update => {
  countsMap.set(
    update.passenger_id,
    (countsMap.get(update.passenger_id) || 0) + 1
  )
})

// Merge with passengers
const passengersWithCounts = passengers?.map(p => ({
  ...p,
  updateCount: countsMap.get(p.id) || 0
}))
```

---

## Complex Queries

### Get Passenger with Everything
```typescript
const { data, error } = await supabase
  .from('passengers')
  .select(`
    *,
    schools (
      id,
      name,
      address
    ),
    routes (
      id,
      route_number
    ),
    passenger_parent_contacts (
      id,
      parent_contacts (
        id,
        full_name,
        relationship,
        phone_number,
        email,
        address
      )
    ),
    passenger_updates (
      id,
      update_text,
      created_at,
      users (
        email
      )
    )
  `)
  .eq('id', passengerId)
  .single()
```

### Get All Incidents for a Passenger
```typescript
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
```

### Get All Incidents for an Employee
```typescript
const { data, error } = await supabase
  .from('incident_employees')
  .select(`
    *,
    incidents (
      id,
      incident_type,
      description,
      reported_at,
      resolved
    )
  `)
  .eq('employee_id', employeeId)
  .order('incidents(reported_at)', { ascending: false })
```

---

## Filtering and Searching

### Search Passengers by Name
```typescript
const { data, error } = await supabase
  .from('passengers')
  .select('*, schools(name)')
  .ilike('full_name', `%${searchTerm}%`)
  .order('full_name')
```

### Get Open Incidents Only
```typescript
const { data, error } = await supabase
  .from('incidents')
  .select('*, vehicles(*), routes(*)')
  .eq('resolved', false)
  .order('reported_at', { ascending: false })
```

### Get Passengers by School
```typescript
const { data, error } = await supabase
  .from('passengers')
  .select('*, routes(*)')
  .eq('school_id', schoolId)
  .order('full_name')
```

---

## Counting and Aggregation

### Count Updates per Passenger
```typescript
const { data, error } = await supabase
  .from('passenger_updates')
  .select('passenger_id')

const counts = data?.reduce((acc, { passenger_id }) => {
  acc[passenger_id] = (acc[passenger_id] || 0) + 1
  return acc
}, {} as Record<number, number>)
```

### Count Parent Contacts per Passenger
```typescript
const { data, error } = await supabase
  .from('passenger_parent_contacts')
  .select('passenger_id')

const counts = data?.reduce((acc, { passenger_id }) => {
  acc[passenger_id] = (acc[passenger_id] || 0) + 1
  return acc
}, {} as Record<number, number>)
```

---

## Error Handling Pattern

```typescript
async function safeQuery() {
  try {
    const { data, error } = await supabase
      .from('table_name')
      .select('*')

    if (error) {
      console.error('Supabase error:', error)
      throw new Error(error.message)
    }

    return data
  } catch (err) {
    console.error('Unexpected error:', err)
    // Handle or rethrow
    throw err
  }
}
```

---

## Real-time Subscriptions (Bonus)

### Subscribe to Passenger Updates
```typescript
const subscription = supabase
  .channel('passenger_updates_channel')
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'passenger_updates',
      filter: `passenger_id=eq.${passengerId}`
    },
    (payload) => {
      console.log('Update received:', payload)
      // Refresh your UI
    }
  )
  .subscribe()

// Cleanup
subscription.unsubscribe()
```

---

**Last Updated:** November 22, 2025  
**Supabase Version:** Latest  
**Next.js Version:** 14 (App Router)

