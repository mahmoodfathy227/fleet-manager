'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Plus, X } from 'lucide-react'
import { ParentContact } from '@/lib/types'

interface AddParentContactButtonProps {
  passengerId: number
}

export default function AddParentContactButton({ passengerId }: AddParentContactButtonProps) {
  const router = useRouter()
  const supabase = createClient()
  const [showModal, setShowModal] = useState(false)
  const [addMode, setAddMode] = useState<'existing' | 'new'>('existing')
  const [allParentContacts, setAllParentContacts] = useState<ParentContact[]>([])
  const [selectedContactId, setSelectedContactId] = useState<string>('')
  const [newContact, setNewContact] = useState({
    full_name: '',
    relationship: '',
    phone_number: '',
    email: '',
    address: '',
  })

  useEffect(() => {
    if (showModal) {
      loadAllParentContacts()
    }
  }, [showModal])

  const loadAllParentContacts = async () => {
    const { data, error } = await supabase
      .from('parent_contacts')
      .select('*')
      .order('full_name')

    if (!error && data) {
      setAllParentContacts(data)
    }
  }

  const handleAddExistingContact = async () => {
    if (!selectedContactId) return

    const { error } = await supabase
      .from('passenger_parent_contacts')
      .insert([{ passenger_id: passengerId, parent_contact_id: parseInt(selectedContactId) }])

    if (!error) {
      setShowModal(false)
      setSelectedContactId('')
      router.refresh()
    } else {
      alert('Failed to link contact: ' + error.message)
    }
  }

  const handleCreateAndLinkContact = async () => {
    // Create new contact
    const { data: newContactData, error: createError } = await supabase
      .from('parent_contacts')
      .insert([newContact])
      .select()
      .single()

    if (createError) {
      alert('Failed to create contact: ' + createError.message)
      return
    }

    // Link to passenger
    const { error: linkError } = await supabase
      .from('passenger_parent_contacts')
      .insert([{ passenger_id: passengerId, parent_contact_id: newContactData.id }])

    if (!linkError) {
      setShowModal(false)
      setNewContact({ full_name: '', relationship: '', phone_number: '', email: '', address: '' })
      router.refresh()
    } else {
      alert('Failed to link contact: ' + linkError.message)
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setShowModal(true)}>
        <Plus className="mr-2 h-4 w-4" />
        Add Parent Contact
      </Button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-primary text-white p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">Add Parent Contact</h2>
              <button onClick={() => setShowModal(false)}>
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Mode Selection */}
              <div className="flex space-x-4">
                <Button
                  variant={addMode === 'existing' ? 'primary' : 'secondary'}
                  onClick={() => setAddMode('existing')}
                >
                  Link Existing Contact
                </Button>
                <Button
                  variant={addMode === 'new' ? 'primary' : 'secondary'}
                  onClick={() => setAddMode('new')}
                >
                  Create New Contact
                </Button>
              </div>

              {/* Existing Contact Mode */}
              {addMode === 'existing' && (
                <div className="space-y-4">
                  <Label htmlFor="existing-contact">Select Parent Contact</Label>
                  <Select
                    id="existing-contact"
                    value={selectedContactId}
                    onChange={(e) => setSelectedContactId(e.target.value)}
                  >
                    <option value="">Choose a contact...</option>
                    {allParentContacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.full_name} - {contact.relationship || 'Unknown'} - {contact.phone_number || 'No phone'}
                      </option>
                    ))}
                  </Select>
                  <div className="flex justify-end space-x-3 mt-4">
                    <Button variant="secondary" onClick={() => setShowModal(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddExistingContact} disabled={!selectedContactId}>
                      Link Contact
                    </Button>
                  </div>
                </div>
              )}

              {/* New Contact Mode */}
              {addMode === 'new' && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="new-name">Full Name *</Label>
                    <Input
                      id="new-name"
                      required
                      value={newContact.full_name}
                      onChange={(e) => setNewContact({ ...newContact, full_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-relationship">Relationship</Label>
                    <Select
                      id="new-relationship"
                      value={newContact.relationship}
                      onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
                    >
                      <option value="">Select relationship...</option>
                      <option value="Mother">Mother</option>
                      <option value="Father">Father</option>
                      <option value="Guardian">Guardian</option>
                      <option value="Grandparent">Grandparent</option>
                      <option value="Other">Other</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="new-phone">Phone Number</Label>
                    <Input
                      id="new-phone"
                      type="tel"
                      value={newContact.phone_number}
                      onChange={(e) => setNewContact({ ...newContact, phone_number: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-email">Email</Label>
                    <Input
                      id="new-email"
                      type="email"
                      value={newContact.email}
                      onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-address">Address</Label>
                    <textarea
                      id="new-address"
                      rows={3}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={newContact.address}
                      onChange={(e) => setNewContact({ ...newContact, address: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end space-x-3 mt-4">
                    <Button variant="secondary" onClick={() => setShowModal(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateAndLinkContact} disabled={!newContact.full_name.trim()}>
                      Create & Link
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

