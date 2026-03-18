'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FileText, Save, CheckCircle, AlertCircle, FileDown } from 'lucide-react'

interface TR6FormProps {
  incident: {
    id: number
    description: string | null
    reported_at: string
    location: string | null
    vehicles?: {
      id: number
      vehicle_identifier: string | null
      registration: string | null
      plate_number: string | null
    } | null
  }
}

export default function TR6Form({ incident }: TR6FormProps) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const formatDateTime = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const timeStr = date.toTimeString().slice(0, 5)
    return `${dateStr} ${timeStr}`
  }

  const [formData, setFormData] = useState({
    other_driver_name: '',
    is_registered_owner: '',
    vehicle_owner_name: '',
    insurance_company: '',
    insurance_policy_number: '',
    other_vehicle_make: '',
    other_vehicle_colour: '',
    other_vehicle_registration: '',
    damage_description: incident.description || '',
    accident_location: incident.location || '',
    accident_datetime: formatDateTime(incident.reported_at),
    witness_names: '',
    witness_address: '',
    other_driver_comments: '',
  })

  // Load saved TR6 form data if it exists
  useEffect(() => {
    loadSavedFormData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incident.id])

  const loadSavedFormData = async () => {
    try {
      setLoading(true)
      const { data: savedForm, error } = await supabase
        .from('documents')
        .select('file_url')
        .eq('owner_type', 'incident')
        .eq('owner_id', incident.id)
        .eq('doc_type', 'TR6 Form')
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Error loading saved TR6 form:', error)
      } else if (savedForm?.file_url) {
        try {
          const savedData = typeof savedForm.file_url === 'string' 
            ? JSON.parse(savedForm.file_url)
            : savedForm.file_url

          if (savedData && typeof savedData === 'object') {
            setFormData(prev => ({
              ...prev,
              ...savedData,
              damage_description: savedData.damage_description || prev.damage_description,
              accident_location: savedData.accident_location || prev.accident_location,
              accident_datetime: savedData.accident_datetime || prev.accident_datetime,
            }))
          }
        } catch (parseError) {
          console.error('Error parsing saved TR6 form data:', parseError)
        }
      }
    } catch (err) {
      console.error('Error loading saved TR6 form:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSaveForm = async () => {
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        throw new Error('You must be logged in to save the form')
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser.email)
        .maybeSingle()

      const { data: existingForm } = await supabase
        .from('documents')
        .select('id')
        .eq('owner_type', 'incident')
        .eq('owner_id', incident.id)
        .eq('doc_type', 'TR6 Form')
        .maybeSingle()

      const formDataJson = JSON.stringify(formData)
      const fileName = `TR6_Form_Incident_${incident.id}_${new Date().toISOString().split('T')[0]}.json`

      if (existingForm) {
        const { error: updateError } = await supabase
          .from('documents')
          .update({
            file_url: formDataJson,
            file_name: fileName,
            file_type: 'application/json',
            uploaded_by: userData?.id || null,
            uploaded_at: new Date().toISOString(),
          })
          .eq('id', existingForm.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('documents')
          .insert({
            owner_type: 'incident',
            owner_id: incident.id,
            doc_type: 'TR6 Form',
            file_name: fileName,
            file_type: 'application/json',
            file_url: formDataJson,
            uploaded_by: userData?.id || null,
          })

        if (insertError) throw insertError
      }

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      console.error('Error saving TR6 form:', err)
      setSaveError(err.message || 'Failed to save TR6 form')
    } finally {
      setSaving(false)
    }
  }

  const handleExportWord = async () => {
    setExporting(true)
    setSaveError(null)

    try {
      const response = await fetch(`/api/incidents/${incident.id}/export-tr6`, {
        method: 'GET',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `TR6_Incident_${incident.id}.docx`

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '')
        }
      }

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error('Error exporting TR6 document:', err)
      setSaveError(err.message || 'Failed to export TR6 document')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-2.5 px-4">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center">
            <FileText className="mr-2 h-4 w-4" />
            TR6 Form - Vehicle Accident Report
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <p className="text-sm text-gray-500">Loading form data...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="bg-slate-50 border-b border-slate-100 py-2.5 px-4">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center">
          <FileText className="mr-2 h-4 w-4" />
          TR6 Form - Vehicle Accident Report
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="other_driver_name">Other Driver Name</Label>
              <Input
                id="other_driver_name"
                value={formData.other_driver_name}
                onChange={(e) => handleInputChange('other_driver_name', e.target.value)}
                placeholder="Enter driver name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="is_registered_owner">Is Registered Owner?</Label>
              <select
                id="is_registered_owner"
                value={formData.is_registered_owner}
                onChange={(e) => handleInputChange('is_registered_owner', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy"
              >
                <option value="">Select...</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicle_owner_name">Vehicle Owner Name</Label>
              <Input
                id="vehicle_owner_name"
                value={formData.vehicle_owner_name}
                onChange={(e) => handleInputChange('vehicle_owner_name', e.target.value)}
                placeholder="Enter owner name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="insurance_company">Insurance Company</Label>
              <Input
                id="insurance_company"
                value={formData.insurance_company}
                onChange={(e) => handleInputChange('insurance_company', e.target.value)}
                placeholder="Enter insurance company"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="insurance_policy_number">Insurance Policy Number</Label>
              <Input
                id="insurance_policy_number"
                value={formData.insurance_policy_number}
                onChange={(e) => handleInputChange('insurance_policy_number', e.target.value)}
                placeholder="Enter policy number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="other_vehicle_make">Other Vehicle Make</Label>
              <Input
                id="other_vehicle_make"
                value={formData.other_vehicle_make}
                onChange={(e) => handleInputChange('other_vehicle_make', e.target.value)}
                placeholder="Enter vehicle make"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="other_vehicle_colour">Other Vehicle Colour</Label>
              <Input
                id="other_vehicle_colour"
                value={formData.other_vehicle_colour}
                onChange={(e) => handleInputChange('other_vehicle_colour', e.target.value)}
                placeholder="Enter vehicle colour"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="other_vehicle_registration">Other Vehicle Registration</Label>
              <Input
                id="other_vehicle_registration"
                value={formData.other_vehicle_registration}
                onChange={(e) => handleInputChange('other_vehicle_registration', e.target.value)}
                placeholder="Enter registration number"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="damage_description">Damage Description</Label>
              <textarea
                id="damage_description"
                value={formData.damage_description}
                onChange={(e) => handleInputChange('damage_description', e.target.value)}
                placeholder="Describe the damage to vehicles"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accident_location">Accident Location</Label>
              <Input
                id="accident_location"
                value={formData.accident_location}
                onChange={(e) => handleInputChange('accident_location', e.target.value)}
                placeholder="Enter accident location"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accident_datetime">Accident Date & Time</Label>
              <Input
                id="accident_datetime"
                value={formData.accident_datetime}
                onChange={(e) => handleInputChange('accident_datetime', e.target.value)}
                placeholder="DD/MM/YYYY HH:MM"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="witness_names">Witness Names</Label>
              <Input
                id="witness_names"
                value={formData.witness_names}
                onChange={(e) => handleInputChange('witness_names', e.target.value)}
                placeholder="Enter witness names (comma separated)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="witness_address">Witness Address</Label>
              <Input
                id="witness_address"
                value={formData.witness_address}
                onChange={(e) => handleInputChange('witness_address', e.target.value)}
                placeholder="Enter witness address"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="other_driver_comments">Other Driver Comments</Label>
              <textarea
                id="other_driver_comments"
                value={formData.other_driver_comments}
                onChange={(e) => handleInputChange('other_driver_comments', e.target.value)}
                placeholder="Enter any comments from the other driver"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy"
              />
            </div>
          </div>

          {saveError && (
            <div className="flex items-start p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{saveError}</p>
              </div>
              <button
                onClick={() => setSaveError(null)}
                className="text-red-600 hover:text-red-800"
              >
                ×
              </button>
            </div>
          )}

          {saveSuccess && (
            <div className="flex items-start p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-green-800">Success</h3>
                <p className="text-sm text-green-700 mt-1">TR6 form saved successfully!</p>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={handleExportWord}
              disabled={saving || loading || exporting}
            >
              {exporting ? (
                <>Exporting...</>
              ) : (
                <>
                  <FileDown className="mr-2 h-4 w-4" />
                  Export Word
                </>
              )}
            </Button>
            <Button
              type="button"
              onClick={handleSaveForm}
              disabled={saving || loading || exporting}
            >
              {saving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Form
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

