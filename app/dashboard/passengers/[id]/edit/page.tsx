'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import { ConfirmDeleteCard } from '@/components/ui/ConfirmDeleteCard'
import { ArrowLeft, Trash2, AlertCircle, MapPin, School as SchoolIcon, Bus, Users, Edit2 } from 'lucide-react'
import Link from 'next/link'
import { EditParentContactModal } from '../EditParentContactModal'

function EditPassengerPageClient({ id }: { id: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [schools, setSchools] = useState<any[]>([])
  const [routes, setRoutes] = useState<any[]>([])
  const [parentContactLinks, setParentContactLinks] = useState<any[]>([])
  const [editingContactId, setEditingContactId] = useState<number | null>(null)

  const [formData, setFormData] = useState({
    full_name: '',
    dob: '',
    gender: '',
    address: '',
    important_notes: '',
    sen_requirements: '',
    school_id: '',
    mobility_type: '',
    route_id: '',
    seat_number: '',
    personal_item: '',
    supervision_type: '',
  })

  useEffect(() => {
    async function loadData() {
      const [passengerResult, schoolsResult, routesResult] = await Promise.all([
        supabase.from('passengers').select('*').eq('id', id).single(),
        supabase.from('schools').select('id, name').order('name'),
        supabase.from('routes').select('id, route_number, school_id').order('route_number')
      ])

      if (passengerResult.error) {
        setError('Failed to load passenger')
        return
      }

      if (passengerResult.data) {
        setFormData({
          full_name: passengerResult.data.full_name || '',
          dob: passengerResult.data.dob || '',
          gender: passengerResult.data.gender || '',
          address: passengerResult.data.address || '',
          important_notes: passengerResult.data.important_notes || '',
          sen_requirements: passengerResult.data.sen_requirements || '',
          school_id: passengerResult.data.school_id || '',
          mobility_type: passengerResult.data.mobility_type || '',
          route_id: passengerResult.data.route_id || '',
          seat_number: passengerResult.data.seat_number || '',
          personal_item: passengerResult.data.personal_item || '',
          supervision_type: passengerResult.data.supervision_type || '',
        })
      }

      if (schoolsResult.data) setSchools(schoolsResult.data)
      if (routesResult.data) setRoutes(routesResult.data)

      // Load parent contacts linked to this passenger
      const { data: links } = await supabase
        .from('passenger_parent_contacts')
        .select('*, parent_contacts(*)')
        .eq('passenger_id', id)
      if (links) setParentContactLinks(links)
    }

    loadData()
  }, [id, supabase])

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
      const { error } = await supabase.from('passengers').update(formData).eq('id', id)
      if (error) throw error

      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_name: 'passengers', record_id: parseInt(id), action: 'UPDATE' }),
      })

      router.push(`/dashboard/passengers/${id}`)
      router.refresh()
    } catch (error: any) {
      setError(error.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      const { error: deleteErr } = await supabase.from('passengers').delete().eq('id', id)
      if (deleteErr) throw deleteErr

      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_name: 'passengers', record_id: parseInt(id), action: 'DELETE' }),
      })

      router.push('/dashboard/passengers')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto p-4 space-y-6">
      {showDeleteConfirm && (
        <ConfirmDeleteCard
          entityName={formData.full_name || 'this passenger'}
          items={[
            'The passenger record',
            'All route and pickup assignments',
            'All incident links and notes',
            'Parent/guardian contact links for this passenger',
          ]}
          confirmLabel="Yes, Delete Passenger"
          onConfirm={handleDelete}
          onCancel={() => {
            setShowDeleteConfirm(false)
            setError(null)
          }}
          loading={deleting}
          error={error}
        />
      )}

      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 -mx-6 -mt-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/passengers/${id}`}>
            <Button variant="outline" size="sm" className="h-9 px-3 gap-2 text-slate-600 border-slate-300 hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Edit Passenger</h1>
            <p className="text-xs text-slate-500">Update details for {formData.full_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)} disabled={deleting} className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200">
            Delete Passenger
          </Button>
          <div className="h-6 w-px bg-slate-200 mx-2" />
          <Link href={`/dashboard/passengers/${id}`}>
            <Button variant="outline" size="sm" className="text-slate-600 border-slate-300 hover:bg-slate-50">Cancel</Button>
          </Link>
          <Button onClick={handleSubmit} disabled={loading} className="min-w-[100px]">
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {error && !showDeleteConfirm && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-3 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Column 1: Identity (Left) - 3 cols */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 border-b pb-2">Identity</h2>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="full_name" className="text-xs text-slate-500">Full Name *</Label>
                  <Input id="full_name" value={formData.full_name} onChange={handleInputChange} required className="h-8 text-sm font-medium" />
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
                  <Input id="supervision_type" value={formData.supervision_type} onChange={handleInputChange} className="h-8 text-sm" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Column 2: Journey (Center) - 5 cols */}
        <div className="lg:col-span-5 space-y-4">
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
                  <Input id="seat_number" value={formData.seat_number} onChange={handleInputChange} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="personal_item" className="text-xs text-slate-500">Personal Item</Label>
                  <Input id="personal_item" value={formData.personal_item} onChange={handleInputChange} className="h-8 text-sm" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Column 3: Critical Info (Right) - 4 cols */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="h-full">
            <CardContent className="p-4 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 border-b pb-2">Requirements & Notes</h2>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="address" className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="h-3 w-3" /> Home Address</Label>
                  <textarea id="address" value={formData.address} onChange={handleInputChange} rows={2} className="w-full text-sm border-slate-300 rounded-md focus:ring-primary focus:border-primary" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sen_requirements" className="text-xs font-bold text-slate-700">SEN Requirements</Label>
                  <textarea id="sen_requirements" value={formData.sen_requirements} onChange={handleInputChange} rows={3} className="w-full text-sm bg-blue-50/50 border-blue-200 rounded-md focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="important_notes" className="text-xs font-bold text-amber-700 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Important Notes</Label>
                  <textarea id="important_notes" value={formData.important_notes} onChange={handleInputChange} rows={3} className="w-full text-sm bg-amber-50 border-amber-200 rounded-md focus:ring-amber-500 focus:border-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parent contacts - edit from passenger edit */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 border-b pb-2 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Parent Contacts
              </h2>
              {parentContactLinks.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No parent contacts linked. Add or manage contacts from the passenger detail page.</p>
              ) : (
                <ul className="space-y-2">
                  {parentContactLinks.map((link: any) => (
                    <li key={link.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-md border border-slate-200">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{link.parent_contacts?.full_name}</p>
                        <p className="text-xs text-slate-500">{link.parent_contacts?.relationship || '—'} · {link.parent_contacts?.phone_number || 'No phone'}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-primary"
                          onClick={() => link.parent_contacts?.id != null && setEditingContactId(link.parent_contacts.id)}
                          title="Edit contact"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Link href={`/dashboard/parent-contacts/${link.parent_contacts?.id}`} target="_blank" rel="noopener noreferrer">
                          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500" title="View contact">
                            View
                          </Button>
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={`/dashboard/passengers/${id}`}>
                <Button type="button" variant="outline" size="sm" className="w-full border-slate-300 text-slate-600">
                  Manage parent contacts on detail page
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </form>

      <EditParentContactModal
        contactId={editingContactId}
        isOpen={editingContactId != null}
        onClose={() => setEditingContactId(null)}
        onSaved={() => {
          setEditingContactId(null)
          supabase.from('passenger_parent_contacts').select('*, parent_contacts(*)').eq('passenger_id', id).then(({ data }) => data && setParentContactLinks(data))
        }}
      />
    </div>
  )
}

export default async function EditPassengerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <EditPassengerPageClient id={id} />
}
