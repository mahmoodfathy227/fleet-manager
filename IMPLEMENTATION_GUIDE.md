# Fleet Management System - Relational Design Implementation

## Overview
This document describes the comprehensive expansion of the Fleet Management System with enhanced relational design, new CRUD operations, and UI improvements.

---

## 🗄️ Database Schema Changes

### 1. Passenger Updates Table
**File:** `supabase/migrations/013_passenger_updates.sql`

```sql
CREATE TABLE passenger_updates (
  id SERIAL PRIMARY KEY,
  passenger_id INTEGER NOT NULL REFERENCES passengers(id) ON DELETE CASCADE,
  update_text TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose:** Track notes and updates for each passenger over time.

### 2. Existing Junction Tables
The system already includes:
- `passenger_parent_contacts` - Links passengers to parent contacts (M:N)
- `incident_passengers` - Links incidents to passengers (M:N)
- `incident_employees` - Links incidents to employees (M:N)

---

## 📁 TypeScript Types

**File:** `lib/types.ts`

Key types added:
```typescript
export interface PassengerUpdate {
  id: number
  passenger_id: number
  update_text: string
  updated_by: number | null
  created_at: string
  updated_at: string
  users?: User | null
}

export interface IncidentWithRelations extends Incident {
  employees?: Employee | null
  vehicles?: Vehicle | null
  routes?: Route | null
  incident_employees?: IncidentEmployee[]
  incident_passengers?: IncidentPassenger[]
}

export interface PassengerWithRelations extends Passenger {
  schools?: School | null
  routes?: Route | null
  passenger_parent_contacts?: (PassengerParentContact & {
    parent_contacts?: ParentContact
  })[]
  passenger_updates?: PassengerUpdate[]
}
```

---

## 🎯 Key Features Implemented

### 1️⃣ Enhanced Incident Management

#### Incident View Page (`app/dashboard/incidents/[id]/page.tsx`)

**Features:**
- Displays all related employees with "View Profile" links
- Shows all related passengers with school information
- Links to vehicle and route detail pages
- Navy blue themed headers with icons
- Improved layout with related entities in separate cards

**Query Example:**
```typescript
// Fetch incident with all relations
const { data: incident } = await supabase
  .from('incidents')
  .select(`
    *,
    vehicles(id, vehicle_identifier, make, model),
    routes(id, route_number)
  `)
  .eq('id', id)
  .single()

// Fetch related employees
const { data: relatedEmployees } = await supabase
  .from('incident_employees')
  .select('*, employees(id, full_name, role)')
  .eq('incident_id', id)

// Fetch related passengers
const { data: relatedPassengers } = await supabase
  .from('incident_passengers')
  .select('*, passengers(id, full_name, schools(name))')
  .eq('incident_id', id)
```

#### Incident Create Page (`app/dashboard/incidents/create/page.tsx`)

**Already Implemented:**
- Multi-select checkboxes for employees
- Multi-select checkboxes for passengers
- Vehicle and route dropdowns
- Batch inserts into junction tables

---

### 2️⃣ Passenger Parent Contacts & Updates

#### Passenger Detail Client Component (`app/dashboard/passengers/[id]/PassengerDetailClient.tsx`)

**Features:**

**Tab 1: Parent Contacts**
- Lists all linked parent contacts with full details
- "Add Parent Contact" button with modal
- Two modes:
  - Link existing contact (dropdown selector)
  - Create new contact (full form)
- Unlink functionality with confirmation
- Direct links to parent contact profiles

**Tab 2: Updates & Notes**
- Chronological list of all passenger updates
- Add new update with text area
- Edit existing updates inline
- Delete updates with confirmation
- Shows author (user email) and timestamp
- Rich text display with proper formatting

**Query Examples:**

```typescript
// Load parent contacts
const { data } = await supabase
  .from('passenger_parent_contacts')
  .select('*, parent_contacts(*)')
  .eq('passenger_id', passengerId)

// Load updates
const { data } = await supabase
  .from('passenger_updates')
  .select('*, users(email)')
  .eq('passenger_id', passengerId)
  .order('created_at', { ascending: false })

// Add new update
await supabase
  .from('passenger_updates')
  .insert([{
    passenger_id: passengerId,
    update_text: newUpdateText,
  }])

// Link existing parent contact
await supabase
  .from('passenger_parent_contacts')
  .insert([{
    passenger_id: passengerId,
    parent_contact_id: selectedContactId
  }])

// Create and link new parent contact
const { data: newContact } = await supabase
  .from('parent_contacts')
  .insert([contactData])
  .select()
  .single()

await supabase
  .from('passenger_parent_contacts')
  .insert([{
    passenger_id: passengerId,
    parent_contact_id: newContact.id
  }])
```

---

### 3️⃣ Passenger List Page Enhancement

**File:** `app/dashboard/passengers/page.tsx`

**Features:**
- Added "Updates" column showing count badge
- Badge displays with MessageSquare icon
- Tooltip shows number of updates
- Purple-themed badge for visibility

**Query:**
```typescript
// Fetch passengers with update counts
const { data: passengers } = await supabase
  .from('passengers')
  .select('*, schools(name), routes(route_number)')

const { data: updateCounts } = await supabase
  .from('passenger_updates')
  .select('passenger_id')

// Map counts to passengers
const countsMap = new Map()
updateCounts?.forEach(update => {
  countsMap.set(update.passenger_id, (countsMap.get(update.passenger_id) || 0) + 1)
})
```

---

### 4️⃣ Dashboard Integration

**File:** `app/dashboard/page.tsx`

**New Statistics Cards:**

1. **Incidents This Month**
   - Counts incidents reported in current month
   - Orange themed
   - Links to incidents page

2. **Passengers with Parent Links**
   - Shows count of unique passengers linked to at least one parent
   - Teal themed
   - Links to passengers page

3. **Recent Passenger Updates**
   - Total count of all updates
   - Shows latest update date
   - Purple themed
   - Links to passengers page

**Query Examples:**
```typescript
// Incidents this month
const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
const { count } = await supabase
  .from('incidents')
  .select('*', { count: 'exact', head: true })
  .gte('reported_at', firstDayOfMonth)

// Passengers with parent links
const { data: passengersWithLinks } = await supabase
  .from('passenger_parent_contacts')
  .select('passenger_id')

const uniquePassengersWithLinks = new Set(passengersWithLinks?.map(p => p.passenger_id)).size

// Recent updates
const { count, data: recentUpdates } = await supabase
  .from('passenger_updates')
  .select('created_at', { count: 'exact' })
  .order('created_at', { ascending: false })
  .limit(1)
```

---

## 🎨 UI/UX Design Guidelines

### Color Scheme
- **Primary (Navy Blue):** `#1e3a8a` → `bg-navy` or `text-navy`
- **Headers:** Navy blue background with white text
- **Cards:** White background with navy headers
- **Buttons:** Navy blue primary buttons
- **Table Rows:** Alternating `bg-white` / `bg-gray-50`

### Component Patterns

**Card Header:**
```tsx
<CardHeader className="bg-navy text-white">
  <CardTitle className="flex items-center">
    <Icon className="mr-2 h-5 w-5" />
    Title Text
  </CardTitle>
</CardHeader>
```

**Status Badge:**
```tsx
<span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold bg-green-100 text-green-800">
  Status
</span>
```

**Action Button with Icon:**
```tsx
<Button variant="ghost" size="sm" className="text-navy">
  View Profile
  <ExternalLink className="ml-1 h-3 w-3" />
</Button>
```

### Loading States
- Used `<Suspense>` with skeleton loaders
- Smooth transitions with `transition-all` classes
- Hover effects on clickable cards: `hover:shadow-lg hover:border-navy`

---

## 🔗 CRUD Operations Reference

### Create Operations

```typescript
// Create parent contact
const { data, error } = await supabase
  .from('parent_contacts')
  .insert([{
    full_name: 'John Doe',
    relationship: 'Father',
    phone_number: '123-456-7890',
    email: 'john@example.com'
  }])
  .select()
  .single()

// Create passenger update
await supabase
  .from('passenger_updates')
  .insert([{
    passenger_id: 1,
    update_text: 'New update text'
  }])

// Link passenger to parent
await supabase
  .from('passenger_parent_contacts')
  .insert([{
    passenger_id: 1,
    parent_contact_id: 2
  }])
```

### Read Operations

```typescript
// Get passenger with all relations
const { data } = await supabase
  .from('passengers')
  .select(`
    *,
    schools(name),
    routes(route_number),
    passenger_parent_contacts(
      *,
      parent_contacts(*)
    ),
    passenger_updates(
      *,
      users(email)
    )
  `)
  .eq('id', passengerId)
  .single()

// Get incidents with related entities
const { data } = await supabase
  .from('incidents')
  .select(`
    *,
    vehicles(*),
    routes(*),
    incident_employees(*, employees(*)),
    incident_passengers(*, passengers(*))
  `)
```

### Update Operations

```typescript
// Update passenger update text
await supabase
  .from('passenger_updates')
  .update({ update_text: 'Updated text' })
  .eq('id', updateId)

// Update incident resolution status
await supabase
  .from('incidents')
  .update({ resolved: true })
  .eq('id', incidentId)
```

### Delete Operations

```typescript
// Unlink parent contact (cascade safe)
await supabase
  .from('passenger_parent_contacts')
  .delete()
  .eq('id', linkId)

// Delete passenger update
await supabase
  .from('passenger_updates')
  .delete()
  .eq('id', updateId)
```

---

## 🚀 Running Migrations

1. **Apply the new migration:**
   ```bash
   supabase migration up
   ```

2. **Or manually run in Supabase SQL Editor:**
   - Navigate to SQL Editor in Supabase Dashboard
   - Copy contents of `supabase/migrations/013_passenger_updates.sql`
   - Execute the SQL

3. **Verify tables exist:**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```

---

## 📊 Row Level Security (RLS)

All new tables have RLS enabled with policies for authenticated users:

```sql
CREATE POLICY "Enable read access for authenticated users" ON passenger_updates
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert access for authenticated users" ON passenger_updates
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update access for authenticated users" ON passenger_updates
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete access for authenticated users" ON passenger_updates
  FOR DELETE USING (auth.role() = 'authenticated');
```

**Note:** Adjust these policies based on your specific security requirements (e.g., role-based access).

---

## 🧪 Testing Checklist

### Incident Management
- [ ] Create incident with multiple employees and passengers
- [ ] View incident shows all linked entities
- [ ] Click "View Profile" links navigate correctly
- [ ] Vehicle and route links work

### Passenger Management
- [ ] View passenger detail page
- [ ] Switch between Parent Contacts and Updates tabs
- [ ] Add existing parent contact
- [ ] Create new parent contact and link
- [ ] Unlink parent contact
- [ ] Add new update
- [ ] Edit existing update
- [ ] Delete update
- [ ] View updates count badge on passengers list

### Dashboard
- [ ] "Incidents This Month" card shows correct count
- [ ] "Passengers with Parent Links" shows unique count
- [ ] "Recent Passenger Updates" shows total and latest date
- [ ] All cards link to correct pages

---

## 🔧 Environment Variables

Ensure these are set in your `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

---

## 📝 Notes

1. **Cascading Deletes:** Passenger updates and junction table entries cascade on delete
2. **Timestamps:** All tables have `created_at` and `updated_at` with triggers
3. **Indexes:** Added for performance on foreign keys and frequently queried columns
4. **Unique Constraints:** Junction tables prevent duplicate links
5. **Audit Logging:** Incident creation logs to audit table

---

## 🎯 Future Enhancements

Potential additions:
- File attachments for passenger updates
- Email notifications for new updates
- Advanced filtering on incidents page
- Export functionality for passenger reports
- Bulk operations for parent contact linking
- Update categories/tags for better organization

---

## 📚 Additional Resources

- [Next.js 14 App Router Docs](https://nextjs.org/docs/app)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev/)

---

**Last Updated:** November 22, 2025  
**Version:** 1.0  
**Author:** AI Development Team

