'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Plus, X, ExternalLink, Trash2, Edit2, MessageSquare } from 'lucide-react'
import { formatDateTime, formatDate } from '@/lib/utils'
import { PassengerUpdate, ParentContact } from '@/lib/types'
import { EditParentContactModal } from './EditParentContactModal'

interface PassengerDetailClientProps {
  passengerId: number
  showOnlyUpdates?: boolean
}

export default function PassengerDetailClient({ passengerId, showOnlyUpdates = false }: PassengerDetailClientProps) {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'parent-contacts' | 'updates'>('parent-contacts')

  // Parent Contacts State
  const [parentContacts, setParentContacts] = useState<any[]>([])
  const [allParentContacts, setAllParentContacts] = useState<ParentContact[]>([])
  const [loadingContacts, setLoadingContacts] = useState(true)
  const [showAddContactModal, setShowAddContactModal] = useState(false)
  const [editingContactId, setEditingContactId] = useState<number | null>(null)
  const [addContactMode, setAddContactMode] = useState<'existing' | 'new'>('existing')
  const [selectedContactId, setSelectedContactId] = useState<string>('')

  // Updates State
  const [updates, setUpdates] = useState<PassengerUpdate[]>([])
  const [loadingUpdates, setLoadingUpdates] = useState(true)
  const [newUpdateText, setNewUpdateText] = useState('')
  const [editingUpdateId, setEditingUpdateId] = useState<number | null>(null)
  const [editingUpdateText, setEditingUpdateText] = useState('')

  // New Contact Form State
  const [newContact, setNewContact] = useState({
    full_name: '',
    relationship: '',
    phone_number: '',
    email: '',
    address: '',
  })

  // Load Parent Contacts
  useEffect(() => {
    loadParentContacts()
    loadAllParentContacts()
  }, [passengerId])

  // Load Updates
  useEffect(() => {
    loadUpdates()
  }, [passengerId])

  const loadParentContacts = async () => {
    setLoadingContacts(true)
    const { data, error } = await supabase
      .from('passenger_parent_contacts')
      .select('*, parent_contacts(*)')
      .eq('passenger_id', passengerId)

    if (!error && data) {
      setParentContacts(data)
    }
    setLoadingContacts(false)
  }

  const loadAllParentContacts = async () => {
    const { data, error } = await supabase
      .from('parent_contacts')
      .select('*')
      .order('full_name')

    if (!error && data) {
      setAllParentContacts(data)
    }
  }

  const loadUpdates = async () => {
    setLoadingUpdates(true)
    const { data, error } = await supabase
      .from('passenger_updates')
      .select('*, users(email)')
      .eq('passenger_id', passengerId)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setUpdates(data)
    }
    setLoadingUpdates(false)
  }

  const handleAddExistingContact = async () => {
    if (!selectedContactId) return

    const { error } = await supabase
      .from('passenger_parent_contacts')
      .insert([{ passenger_id: passengerId, parent_contact_id: parseInt(selectedContactId) }])

    if (!error) {
      loadParentContacts()
      setShowAddContactModal(false)
      setSelectedContactId('')
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
      loadParentContacts()
      loadAllParentContacts()
      setShowAddContactModal(false)
      setNewContact({ full_name: '', relationship: '', phone_number: '', email: '', address: '' })
    } else {
      alert('Failed to link contact: ' + linkError.message)
    }
  }

  const handleRemoveContact = async (linkId: number) => {
    if (!confirm('Are you sure you want to unlink this contact?')) return

    const { error } = await supabase
      .from('passenger_parent_contacts')
      .delete()
      .eq('id', linkId)

    if (!error) {
      loadParentContacts()
    } else {
      alert('Failed to remove link: ' + error.message)
    }
  }

  const handleAddUpdate = async () => {
    if (!newUpdateText.trim()) return

    const { error } = await supabase
      .from('passenger_updates')
      .insert([{
        passenger_id: passengerId,
        update_text: newUpdateText,
      }])

    if (!error) {
      loadUpdates()
      setNewUpdateText('')
    } else {
      alert('Failed to add update: ' + error.message)
    }
  }

  const handleEditUpdate = async (updateId: number) => {
    const { error } = await supabase
      .from('passenger_updates')
      .update({ update_text: editingUpdateText })
      .eq('id', updateId)

    if (!error) {
      loadUpdates()
      setEditingUpdateId(null)
      setEditingUpdateText('')
    } else {
      alert('Failed to update: ' + error.message)
    }
  }

  const handleDeleteUpdate = async (updateId: number) => {
    if (!confirm('Are you sure you want to delete this update?')) return

    const { error } = await supabase
      .from('passenger_updates')
      .delete()
      .eq('id', updateId)

    if (!error) {
      loadUpdates()
    } else {
      alert('Failed to delete update: ' + error.message)
    }
  }

  // If showOnlyUpdates is true, don't show tabs
  if (showOnlyUpdates) {
    return (
      <div className="p-4 space-y-6">
        {/* Add New Update */}
        <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
          <Label htmlFor="new-update" className="text-sm font-medium text-slate-700">Add New Update</Label>
          <textarea
            id="new-update"
            rows={3}
            className="mt-2 flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            placeholder="Enter update or note..."
            value={newUpdateText}
            onChange={(e) => setNewUpdateText(e.target.value)}
          />
          <div className="mt-3 flex justify-end">
            <Button onClick={handleAddUpdate} disabled={!newUpdateText.trim()} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Update
            </Button>
          </div>
        </div>

        {/* Updates List */}
        {loadingUpdates ? (
          <p className="text-sm text-slate-500">Loading updates...</p>
        ) : updates.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No updates recorded yet.</p>
        ) : (
          <div className="space-y-4">
            {updates.map((update: any) => (
              <div key={update.id} className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="text-xs text-slate-500">
                      {formatDateTime(update.created_at)} • By: {update.users?.email || 'System'}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary h-6 w-6 p-0"
                      onClick={() => {
                        setEditingUpdateId(update.id)
                        setEditingUpdateText(update.update_text)
                      }}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-800 h-6 w-6 p-0"
                      onClick={() => handleDeleteUpdate(update.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {editingUpdateId === update.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      className="flex w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                      value={editingUpdateText}
                      onChange={(e) => setEditingUpdateText(e.target.value)}
                    />
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setEditingUpdateId(null)
                          setEditingUpdateText('')
                        }}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => handleEditUpdate(update.id)}>
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-900 whitespace-pre-wrap">{update.update_text}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('parent-contacts')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${activeTab === 'parent-contacts'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
          >
            Parent Contacts ({parentContacts.length})
          </button>
          <button
            onClick={() => setActiveTab('updates')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium ${activeTab === 'updates'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
          >
            Updates & Notes ({updates.length})
          </button>
        </nav>
      </div>

      {/* Parent Contacts Tab */}
      {activeTab === 'parent-contacts' && (
        <Card>
          <CardHeader className="bg-primary text-white">
            <div className="flex items-center justify-between">
              <CardTitle>Parent Contacts</CardTitle>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShowAddContactModal(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Parent Contact
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {loadingContacts ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : parentContacts.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No parent contacts linked yet.</p>
            ) : (
              <div className="space-y-4">
                {parentContacts.map((link: any) => (
                  <div key={link.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-gray-900">{link.parent_contacts?.full_name}</h4>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <p><span className="font-medium">Relationship:</span> {link.parent_contacts?.relationship || 'N/A'}</p>
                        <p><span className="font-medium">Phone:</span> {link.parent_contacts?.phone_number || 'N/A'}</p>
                        <p><span className="font-medium">Email:</span> {link.parent_contacts?.email || 'N/A'}</p>
                        {link.parent_contacts?.address && (
                          <p><span className="font-medium">Address:</span> {link.parent_contacts.address}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary"
                        onClick={() => link.parent_contacts?.id != null && setEditingContactId(link.parent_contacts.id)}
                        title="Edit contact"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <a href={`/dashboard/parent-contacts/${link.parent_contacts?.id}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="text-primary" title="View full contact">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-800"
                        onClick={() => handleRemoveContact(link.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Updates Tab */}
      {activeTab === 'updates' && (
        <Card>
          <CardHeader className="bg-primary text-white">
            <CardTitle className="flex items-center">
              <MessageSquare className="mr-2 h-5 w-5" />
              Passenger Updates & Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {/* Add New Update */}
            <div className="border border-gray-300 rounded-lg p-4 bg-blue-50">
              <Label htmlFor="new-update" className="text-sm font-medium text-gray-700">Add New Update</Label>
              <textarea
                id="new-update"
                rows={3}
                className="mt-2 flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                placeholder="Enter update or note..."
                value={newUpdateText}
                onChange={(e) => setNewUpdateText(e.target.value)}
              />
              <div className="mt-3 flex justify-end">
                <Button onClick={handleAddUpdate} disabled={!newUpdateText.trim()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Update
                </Button>
              </div>
            </div>

            {/* Updates List */}
            {loadingUpdates ? (
              <p className="text-sm text-gray-500">Loading updates...</p>
            ) : updates.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No updates recorded yet.</p>
            ) : (
              <div className="space-y-4">
                {updates.map((update: any) => (
                  <div key={update.id} className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">
                          {formatDateTime(update.created_at)} • By: {update.users?.email || 'System'}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-primary"
                          onClick={() => {
                            setEditingUpdateId(update.id)
                            setEditingUpdateText(update.update_text)
                          }}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-800"
                          onClick={() => handleDeleteUpdate(update.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {editingUpdateId === update.id ? (
                      <div className="space-y-2">
                        <textarea
                          rows={3}
                          className="flex w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
                          value={editingUpdateText}
                          onChange={(e) => setEditingUpdateText(e.target.value)}
                        />
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setEditingUpdateId(null)
                              setEditingUpdateText('')
                            }}
                          >
                            Cancel
                          </Button>
                          <Button size="sm" onClick={() => handleEditUpdate(update.id)}>
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">{update.update_text}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Contact Modal */}
      {showAddContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-primary text-white p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold">Add Parent Contact</h2>
              <button onClick={() => setShowAddContactModal(false)}>
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Mode Selection */}
              <div className="flex space-x-4">
                <Button
                  variant={addContactMode === 'existing' ? 'primary' : 'secondary'}
                  onClick={() => setAddContactMode('existing')}
                >
                  Link Existing Contact
                </Button>
                <Button
                  variant={addContactMode === 'new' ? 'primary' : 'secondary'}
                  onClick={() => setAddContactMode('new')}
                >
                  Create New Contact
                </Button>
              </div>

              {/* Existing Contact Mode */}
              {addContactMode === 'existing' && (
                <div className="space-y-4">
                  <Label htmlFor="existing-contact">Select Parent Contact</Label>
                  <Select
                    id="existing-contact"
                    value={selectedContactId}
                    onChange={(e) => setSelectedContactId(e.target.value)}
                  >
                    <option value="">Choose a contact...</option>
                    {allParentContacts
                      .filter(pc => !parentContacts.some(link => link.parent_contact_id === pc.id))
                      .map((contact) => (
                        <option key={contact.id} value={contact.id}>
                          {contact.full_name} - {contact.relationship || 'Unknown'} - {contact.phone_number || 'No phone'}
                        </option>
                      ))}
                  </Select>
                  <div className="flex justify-end space-x-3 mt-4">
                    <Button variant="secondary" onClick={() => setShowAddContactModal(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddExistingContact} disabled={!selectedContactId}>
                      Link Contact
                    </Button>
                  </div>
                </div>
              )}

              {/* New Contact Mode */}
              {addContactMode === 'new' && (
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
                    <Button variant="secondary" onClick={() => setShowAddContactModal(false)}>
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

      <EditParentContactModal
        contactId={editingContactId}
        isOpen={editingContactId != null}
        onClose={() => setEditingContactId(null)}
        onSaved={() => loadParentContacts()}
      />
    </div>
  )
}

