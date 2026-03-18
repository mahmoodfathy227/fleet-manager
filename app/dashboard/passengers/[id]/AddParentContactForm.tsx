'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Plus, Trash2, Users, AlertCircle } from 'lucide-react'
import { generateUUID } from '@/lib/utils'

interface ParentContact {
  id: string
  full_name: string
  relationship: string
  phone_number: string
  email: string
  address: string
}

interface AddParentContactFormProps {
  passengerId: number
  onSuccess?: () => void
  onCancel?: () => void
}

export default function AddParentContactForm({ passengerId, onSuccess, onCancel }: AddParentContactFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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

  const handleSubmit = async () => {
    setError(null)
    setSuccess(false)
    setLoading(true)

    try {
      // Filter out empty contacts (only ones with names filled in)
      const validParentContacts = parentContacts.filter(
        (contact) => contact.full_name.trim() !== ''
      )

      if (validParentContacts.length === 0) {
        setError('Please add at least one parent contact with a name.')
        setLoading(false)
        return
      }

      // Create parent contacts and link them to passenger
      for (const contact of validParentContacts) {
        // Create parent contact
        const { data: contactData, error: contactError } = await supabase
          .from('parent_contacts')
          .insert([
            {
              full_name: contact.full_name,
              relationship: contact.relationship || null,
              phone_number: contact.phone_number || null,
              email: contact.email || null,
              address: contact.address || null,
            },
          ])
          .select()
          .single()

        if (contactError) {
          console.error('Error creating parent contact:', contactError)
          setError(`Failed to create contact "${contact.full_name}": ${contactError.message}`)
          setLoading(false)
          return
        }

        // Link parent contact to passenger
        const { error: linkError } = await supabase
          .from('passenger_parent_contacts')
          .insert([
            {
              passenger_id: passengerId,
              parent_contact_id: contactData.id,
            },
          ])

        if (linkError) {
          console.error('Error linking parent contact:', linkError)
          setError(`Failed to link contact "${contact.full_name}": ${linkError.message}`)
          setLoading(false)
          return
        }

        // Audit log for parent contact creation
        await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_name: 'parent_contacts',
            record_id: contactData.id,
            action: 'CREATE',
          }),
        }).catch(err => console.error('Audit log error:', err))
      }

      setSuccess(true)
      // Reset form
      setParentContacts([
        {
          id: generateUUID(),
          full_name: '',
          relationship: '',
          phone_number: '',
          email: '',
          address: '',
        },
      ])

      // Refresh the page to show new contacts
      setTimeout(() => {
        router.refresh()
        if (onSuccess) {
          onSuccess()
        }
      }, 1000)
    } catch (error: any) {
      console.error('Error adding parent contacts:', error)
      setError(error.message || 'An error occurred while adding parent contacts')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-600">
              Add emergency contacts, parents, or guardians for this passenger.
              You can add multiple contacts. Leave fields empty if not applicable.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addParentContact}
            className="bg-white text-navy border border-slate-200 hover:bg-gray-50 shadow-sm"
          >
            <Plus className="mr-1 h-4 w-4" />
            Add Another Contact
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="text-sm text-green-800">Parent contacts added successfully!</div>
        </div>
      )}

      <div className="space-y-6">
        {parentContacts.map((contact, index) => (
          <Card key={contact.id} className="border border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50 py-3 px-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">
                  Contact {index + 1}
                </h3>
                {parentContacts.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeParentContact(contact.id)}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`parent_name_${contact.id}`}>
                    Full Name
                  </Label>
                  <Input
                    id={`parent_name_${contact.id}`}
                    value={contact.full_name}
                    onChange={(e) =>
                      updateParentContact(contact.id, 'full_name', e.target.value)
                    }
                    placeholder="e.g., Sarah Johnson"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`parent_relationship_${contact.id}`}>
                    Relationship
                  </Label>
                  <Select
                    id={`parent_relationship_${contact.id}`}
                    value={contact.relationship}
                    onChange={(e) =>
                      updateParentContact(contact.id, 'relationship', e.target.value)
                    }
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

                <div className="space-y-2">
                  <Label htmlFor={`parent_phone_${contact.id}`}>
                    Phone Number
                  </Label>
                  <Input
                    id={`parent_phone_${contact.id}`}
                    type="tel"
                    value={contact.phone_number}
                    onChange={(e) =>
                      updateParentContact(contact.id, 'phone_number', e.target.value)
                    }
                    placeholder="e.g., 07123456789"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`parent_email_${contact.id}`}>
                    Email
                  </Label>
                  <Input
                    id={`parent_email_${contact.id}`}
                    type="email"
                    value={contact.email}
                    onChange={(e) =>
                      updateParentContact(contact.id, 'email', e.target.value)
                    }
                    placeholder="e.g., sarah@example.com"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor={`parent_address_${contact.id}`}>
                    Address
                  </Label>
                  <textarea
                    id={`parent_address_${contact.id}`}
                    rows={2}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={contact.address}
                    onChange={(e) =>
                      updateParentContact(contact.id, 'address', e.target.value)
                    }
                    placeholder="Full address..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end space-x-3 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Saving...' : 'Save Contacts'}
        </Button>
      </div>
    </div>
  )
}

