'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import { ArrowLeft, Plus, Trash2, Users, AlertCircle, MapPin, School as SchoolIcon, Bus } from 'lucide-react'
import Link from 'next/link'
import { generateUUID } from '@/lib/utils'

interface ParentContact {
  id: string
  full_name: string
  relationship: string
  phone_number: string
  email: string
  address: string
}

export default function CreatePassengerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [schools, setSchools] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])

  const [formData, setFormData] = useState({
    full_name: '',
    dob: '',
    gender: '',
    address: '',
    important_notes: '',
    sen_requirements: '',
    school_id: searchParams?.get('school_id') || '',
    mobility_type: '',
    route_id: '',
    seat_number: '',
    personal_item: '',
    supervision_type: '',
  })

  // Start with one empty contact
  const [parentContacts, setParentContacts] = useState<ParentContact[]>([
    {
      id: generateUUID(),
      full_name: '',
      relationship: '',
      phone_number: '',
      email: '',
      address: '',
    },
  ])

  const addParentContact = () => {
    setParentContacts([
      ...parentContacts,
      {
        id: generateUUID(),
        full_name: '',
        relationship: '',
        phone_number: '',
        email: '',
        address: '',
      },
    ])
  }

  const removeParentContact = (id: string) => {
    if (parentContacts.length > 1) {
      setParentContacts(parentContacts.filter((contact) => contact.id !== id))
    }
  }

  const updateParentContact = (id: string, field: keyof ParentContact, value: string) => {
    setParentContacts(
      parentContacts.map((contact) =>
        contact.id === id ? { ...contact, [field]: value } : contact
      )
    )
  }

  useEffect(() => {
    async function loadData() {
      const [schoolsResult, routesResult] = await Promise.all([
        supabase.from('schools').select('id, name').order('name'),
        supabase.from('routes').select('id, route_number, school_id').order('route_number')
      ])

      if (schoolsResult.data) setSchools(schoolsResult.data)
      if (routesResult.data) setRoutes(routesResult.data)
    }

    loadData()
  }, [supabase])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const next = { ...formData, [e.target.id]: e.target.value }
    if (e.target.id === 'school_id') {
      const route = routes.find((r: any) => String(r.id) === next.route_id)
      if (route && String(route.school_id) !== next.school_id) next.route_id = ''
    }
    setFormData(next)
  }

  const routesForSchool = formData.school_id
    ? routes.filter((r: any) => r.school_id == null || r.school_id === '' || String(r.school_id) === String(formData.school_id))
    : []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Step 1: Create the passenger
      const { data: passengerData, error: passengerError } = await supabase
        .from('passengers')
        .insert([{
          ...formData,
          school_id: formData.school_id ? parseInt(formData.school_id) : null,
          route_id: formData.route_id ? parseInt(formData.route_id) : null,
        }])
        .select()
        .single()

      if (passengerError) throw passengerError

      const passengerId = passengerData.id

      // Step 2: Create parent contacts
      const validParentContacts = parentContacts.filter(
        (contact) => contact.full_name.trim() !== ''
      )

      if (validParentContacts.length > 0) {
        for (const contact of validParentContacts) {
          const { data: contactData, error: contactError } = await supabase
            .from('parent_contacts')
            .insert({
              full_name: contact.full_name,
              relationship: contact.relationship || null,
              phone_number: contact.phone_number || null,
              email: contact.email || null,
              address: contact.address || null,
            })
            .select()
            .single()

          if (contactError) {
            console.error('Error creating contact:', contactError)
            continue
          }

          const { error: linkError } = await supabase
            .from('passenger_parent_contacts')
            .insert({
              passenger_id: passengerId,
              parent_contact_id: contactData.id,
            })

          if (linkError) console.error('Error linking contact:', linkError)
        }
      }

      // Audit log
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'passengers',
          record_id: passengerId,
          action: 'CREATE',
        }),
      }).catch(console.error)

      router.push('/dashboard/passengers')
      router.refresh()
    } catch (error: any) {
      console.error('Error creating passenger:', error)
      setError(error.message || 'An error occurred while creating the passenger')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto p-4 space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 -mx-6 -mt-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/passengers">
            <Button variant="outline" size="sm" className="h-9 px-3 gap-2 text-slate-600 border-slate-300 hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Add New Passenger</h1>
            <p className="text-xs text-slate-500">Create a new passenger profile</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/passengers">
            <Button variant="outline" size="sm" className="text-slate-600 border-slate-300 hover:bg-slate-50">Cancel</Button>
          </Link>
          <Button onClick={handleSubmit} disabled={loading} className="min-w-[100px]">
            {loading ? 'Creating...' : 'Create Passenger'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-3 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Column 1: Identity & Status (Left) */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 border-b pb-2">Identity</h2>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="full_name" className="text-xs text-slate-500">Full Name *</Label>
                  <Input id="full_name" value={formData.full_name} onChange={handleInputChange} required className="h-8 text-sm font-medium" placeholder="e.g. John Doe" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="dob" className="text-xs text-slate-500">Date of Birth</Label>
                    <Input type="date" id="dob" value={formData.dob} onChange={handleInputChange} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="gender" className="text-xs text-slate-500">Gender</Label>
                    <Select id="gender" value={formData.gender} onChange={handleInputChange} className="h-8 text-xs">
                      <option value="">Select...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                  <Label htmlFor="mobility_type" className="text-xs text-slate-500">Mobility Type</Label>
                  <Select id="mobility_type" value={formData.mobility_type} onChange={handleInputChange} className="h-8 text-sm">
                    <option value="">Select Mobility...</option>
                    <option value="Ambulant">Ambulant</option>
                    <option value="Wheelchair">Wheelchair</option>
                    <option value="Walker">Walker</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="supervision_type" className="text-xs text-slate-500">Supervision Level</Label>
                  <Input id="supervision_type" value={formData.supervision_type} onChange={handleInputChange} className="h-8 text-sm" placeholder="e.g. 1:1, General" />
                </div>

              </div>
            </CardContent>
          </Card>
        </div>

        {/* Column 2: Journey & Logistics (Center) */}
        <div className="lg:col-span-5 space-y-4">

          {/* Journey Details */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 border-b pb-2">Journey Details</h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1 space-y-1">
                  <Label htmlFor="school_id" className="text-xs text-slate-500 flex items-center gap-1"><SchoolIcon className="h-3 w-3" /> School</Label>
                  <Select id="school_id" value={formData.school_id} onChange={handleInputChange} className="h-8 text-sm">
                    <option value="">Select School...</option>
                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </div>
                <div className="col-span-2 md:col-span-1 space-y-1">
                  <Label htmlFor="route_id" className="text-xs text-slate-500 flex items-center gap-1"><Bus className="h-3 w-3" /> Route</Label>
                  <Select id="route_id" value={formData.route_id} onChange={handleInputChange} className="h-8 text-sm">
                    <option value="">{formData.school_id ? 'Select Route...' : 'Select school first'}</option>
                    {routesForSchool.map((r: any) => <option key={r.id} value={r.id}>{r.route_number || `Route ${r.id}`}</option>)}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="seat_number" className="text-xs text-slate-500">Seat Number</Label>
                  <Input id="seat_number" value={formData.seat_number} onChange={handleInputChange} className="h-8 text-sm" placeholder="e.g. 3A" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="personal_item" className="text-xs text-slate-500">Personal Item</Label>
                  <Input id="personal_item" value={formData.personal_item} onChange={handleInputChange} className="h-8 text-sm" placeholder="e.g. Backpack" />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="address" className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="h-3 w-3" /> Home Address</Label>
                <textarea id="address" value={formData.address} onChange={handleInputChange} rows={2} className="w-full text-sm border-slate-300 rounded-md focus:ring-primary focus:border-primary" placeholder="Full home address..." />
              </div>

            </CardContent>
          </Card>

          {/* SEN & Notes */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sen_requirements" className="text-xs font-bold text-slate-700 uppercase tracking-wider">SEN Requirements</Label>
                <textarea id="sen_requirements" value={formData.sen_requirements} onChange={handleInputChange} rows={3} className="w-full text-sm bg-blue-50/50 border-blue-200 rounded-md focus:ring-blue-500 focus:border-blue-500" placeholder="Specific educational or health needs..." />
              </div>

              <div className="space-y-2">
                <Label htmlFor="important_notes" className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Important Notes</Label>
                <textarea id="important_notes" value={formData.important_notes} onChange={handleInputChange} rows={3} className="w-full text-sm bg-amber-50 border-amber-200 rounded-md focus:ring-amber-500 focus:border-amber-500" placeholder="Critical information visible to drivers..." />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Column 3: Contacts (Right) */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="h-full">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2"><Users className="h-4 w-4" /> Parent Contacts</h2>
                <Button type="button" variant="ghost" size="sm" onClick={addParentContact} className="h-6 w-6 p-0 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {parentContacts.map((contact, index) => (
                  <div key={contact.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50 relative group">
                    {parentContacts.length > 1 && (
                      <button type="button" onClick={() => removeParentContact(contact.id)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-slate-400 uppercase">Contact {index + 1}</h3>
                      <Input
                        value={contact.full_name}
                        onChange={(e) => updateParentContact(contact.id, 'full_name', e.target.value)}
                        className="h-7 text-sm bg-white"
                        placeholder="Full Name"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={contact.relationship}
                          onChange={(e) => updateParentContact(contact.id, 'relationship', e.target.value)}
                          className="h-7 text-xs bg-white"
                        >
                          <option value="">-- Select Relationship --</option>
                          <option value="Mother">Mother</option>
                          <option value="Father">Father</option>
                          <option value="Guardian">Guardian</option>
                          <option value="Grandparent">Grandparent</option>
                          <option value="Aunt">Aunt</option>
                          <option value="Uncle">Uncle</option>
                          <option value="Sibling">Sibling</option>
                          <option value="Foster parents">Foster parents</option>
                          <option value="Other">Other</option>
                        </Select>
                        <Input
                          value={contact.phone_number}
                          onChange={(e) => updateParentContact(contact.id, 'phone_number', e.target.value)}
                          className="h-7 text-xs bg-white"
                          placeholder="Phone"
                        />
                      </div>
                      <Input
                        value={contact.email}
                        onChange={(e) => updateParentContact(contact.id, 'email', e.target.value)}
                        className="h-7 text-xs bg-white"
                        placeholder="Email"
                      />
                      <Input
                        value={contact.address}
                        onChange={(e) => updateParentContact(contact.id, 'address', e.target.value)}
                        className="h-7 text-xs bg-white"
                        placeholder="Address (if different)"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

      </form>
    </div>
  )
}
