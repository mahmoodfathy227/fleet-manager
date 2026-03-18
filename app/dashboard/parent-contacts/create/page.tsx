'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ArrowLeft, Save, AlertCircle, UserPlus } from 'lucide-react'
import Link from 'next/link'

interface Passenger {
  id: number
  full_name: string
  school_id: number
  schools: {
    name: string
  }[] | null
}

export default function CreateParentContactPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [passengers, setPassengers] = useState<Passenger[]>([])
  const [selectedPassengers, setSelectedPassengers] = useState<number[]>([])

  const [formData, setFormData] = useState({
    full_name: '',
    relationship: '',
    phone_number: '',
    email: '',
    address: '',
  })

  useEffect(() => {
    async function loadPassengers() {
      const { data, error } = await supabase
        .from('passengers')
        .select('id, full_name, school_id, schools(name)')
        .order('full_name')

      if (!error && data) {
        setPassengers(data as Passenger[])
      }
    }
    loadPassengers()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handlePassengerToggle = (passengerId: number) => {
    setSelectedPassengers(prev => 
      prev.includes(passengerId)
        ? prev.filter(id => id !== passengerId)
        : [...prev, passengerId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Insert parent contact
      const { data: contact, error: contactError } = await supabase
        .from('parent_contacts')
        .insert({
          full_name: formData.full_name,
          relationship: formData.relationship || null,
          phone_number: formData.phone_number || null,
          email: formData.email || null,
          address: formData.address || null,
        })
        .select()
        .single()

      if (contactError) throw contactError

      // Audit log
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'parent_contacts',
          record_id: contact.id,
          action: 'CREATE',
        }),
      }).catch(err => console.error('Audit log error:', err))

      // Link to selected passengers
      if (selectedPassengers.length > 0) {
        const links = selectedPassengers.map(passengerId => ({
          passenger_id: passengerId,
          parent_contact_id: contact.id,
        }))

        const { error: linkError } = await supabase
          .from('passenger_parent_contacts')
          .insert(links)

        if (linkError) throw linkError
      }

      router.push('/dashboard/parent-contacts')
    } catch (err: any) {
      console.error('Error creating parent contact:', err)
      setError(err.message || 'Failed to create parent contact')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard/parent-contacts">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-navy">Add Parent Contact</h1>
            <p className="mt-2 text-sm text-gray-600">
              Create a new emergency contact or guardian
            </p>
          </div>
        </div>
      </div>

      {error && (
        <Card className="border-l-4 border-red-500 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader className="bg-navy text-white">
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <Label htmlFor="full_name">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="full_name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Sarah Johnson"
                />
              </div>

              <div>
                <Label htmlFor="relationship">Relationship</Label>
                <Select
                  id="relationship"
                  name="relationship"
                  value={formData.relationship}
                  onChange={handleInputChange}
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
              </div>

              <div>
                <Label htmlFor="phone_number">Phone Number</Label>
                <Input
                  id="phone_number"
                  name="phone_number"
                  type="tel"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  placeholder="e.g., 07123456789"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="e.g., sarah@example.com"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-navy focus:outline-none focus:ring-navy sm:text-sm"
                  placeholder="Full address..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-navy text-white">
            <CardTitle className="flex items-center">
              <UserPlus className="mr-2 h-5 w-5" />
              Link to Passengers
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600 mb-4">
              Select passengers that this contact is responsible for:
            </p>
            
            {passengers.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No passengers available</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 max-h-96 overflow-y-auto">
                {passengers.map((passenger) => (
                  <div
                    key={passenger.id}
                    className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => handlePassengerToggle(passenger.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPassengers.includes(passenger.id)}
                      onChange={() => handlePassengerToggle(passenger.id)}
                      className="h-4 w-4 rounded border-gray-300 text-navy focus:ring-navy"
                    />
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {passenger.full_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {passenger.schools?.[0]?.name || 'No school assigned'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-end space-x-4">
              <Link href="/dashboard/parent-contacts">
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={loading}>
                <Save className="mr-2 h-4 w-4" />
                {loading ? 'Creating...' : 'Create Parent Contact'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}

