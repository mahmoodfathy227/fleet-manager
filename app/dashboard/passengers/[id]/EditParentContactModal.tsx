'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'

export interface ParentContactFormData {
  full_name: string
  relationship: string
  phone_number: string
  email: string
  address: string
}

interface EditParentContactModalProps {
  contactId: number | null
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

const emptyForm: ParentContactFormData = {
  full_name: '',
  relationship: '',
  phone_number: '',
  email: '',
  address: '',
}

export function EditParentContactModal({ contactId, isOpen, onClose, onSaved }: EditParentContactModalProps) {
  const supabase = createClient()
  const [formData, setFormData] = useState<ParentContactFormData>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !contactId) {
      setFormData(emptyForm)
      setError(null)
      return
    }
    let cancelled = false
    async function load() {
      const { data, error: fetchError } = await supabase
        .from('parent_contacts')
        .select('*')
        .eq('id', contactId)
        .single()
      if (cancelled) return
      if (fetchError || !data) {
        setError('Failed to load contact')
        setFormData(emptyForm)
        return
      }
      setFormData({
        full_name: data.full_name || '',
        relationship: data.relationship || '',
        phone_number: data.phone_number || '',
        email: data.email || '',
        address: data.address || '',
      })
      setError(null)
    }
    load()
    return () => { cancelled = true }
  }, [isOpen, contactId])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!contactId) return
    setError(null)
    setLoading(true)
    try {
      const { error: updateError } = await supabase
        .from('parent_contacts')
        .update({
          full_name: formData.full_name,
          relationship: formData.relationship || null,
          phone_number: formData.phone_number || null,
          email: formData.email || null,
          address: formData.address || null,
        })
        .eq('id', contactId)

      if (updateError) throw updateError

      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_name: 'parent_contacts', record_id: contactId, action: 'UPDATE' }),
      }).catch(() => {})

      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to update contact')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Parent Contact">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="edit-full_name">Full Name *</Label>
            <Input
              id="edit-full_name"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-relationship">Relationship</Label>
            <Select
              id="edit-relationship"
              name="relationship"
              value={formData.relationship}
              onChange={handleChange}
            >
              <option value="">Select...</option>
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
            <Label htmlFor="edit-phone_number">Phone</Label>
            <Input
              id="edit-phone_number"
              name="phone_number"
              type="tel"
              value={formData.phone_number}
              onChange={handleChange}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
            />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="edit-address">Address</Label>
            <textarea
              id="edit-address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows={2}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
