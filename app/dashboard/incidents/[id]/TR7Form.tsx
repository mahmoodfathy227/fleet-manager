'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FileText, Save, CheckCircle, AlertCircle, FileDown } from 'lucide-react'

interface TR7FormProps {
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
    incident_passengers?: Array<{
      passengers?: {
        id: number
        full_name: string | null
        schools?: {
          name: string | null
        } | null
      } | null
    }>
  }
  driverInfo?: {
    name: string | null
    tasNumber: string | null
  } | null
  paInfo?: {
    name: string | null
    tasNumber: string | null
  } | null
}

export default function TR7Form({ incident, driverInfo, paInfo }: TR7FormProps) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const formatTime = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toTimeString().slice(0, 5)
  }

  const formatDateTime = (dateString: string) => {
    if (!dateString) return ''
    return `${formatDate(dateString)} ${formatTime(dateString)}`
  }

  const passengerNames = incident.incident_passengers?.map(ip => ip.passengers?.full_name).filter(Boolean).join(', ') || ''
  const schoolName = incident.incident_passengers?.[0]?.passengers?.schools?.name || ''

  const [formData, setFormData] = useState({
    incident_date: formatDate(incident.reported_at),
    incident_time: formatTime(incident.reported_at),
    school_name: schoolName,
    passenger_names: passengerNames,
    passenger_ages: '',
    passenger_ethnicity: '',
    operator_name: '',
    vehicle_number: incident.vehicles?.vehicle_identifier || incident.vehicles?.registration || '',
    exit_location: incident.location || '',
    distance_from_destination: '',
    prior_incidents: '',
    passenger_comments: '',
    distinguishing_features: '',
    clothing_description: '',
    school_uniform_details: '',
    tas_staff_name: paInfo?.name || driverInfo?.name || '',
    tas_report_time: formatDateTime(incident.reported_at),
    police_reference_number: '',
    form_completed_by: '',
    signature_name: '',
    signature_date: formatDate(new Date().toISOString()),
  })

  // Load saved TR7 form data if it exists
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
        .eq('doc_type', 'TR7 Form')
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Error loading saved TR7 form:', error)
      } else if (savedForm?.file_url) {
        try {
          const savedData = typeof savedForm.file_url === 'string' 
            ? JSON.parse(savedForm.file_url)
            : savedForm.file_url

          if (savedData && typeof savedData === 'object') {
            setFormData(prev => ({
              ...prev,
              ...savedData,
              incident_date: savedData.incident_date || prev.incident_date,
              incident_time: savedData.incident_time || prev.incident_time,
              school_name: savedData.school_name || prev.school_name,
              passenger_names: savedData.passenger_names || prev.passenger_names,
              vehicle_number: savedData.vehicle_number || prev.vehicle_number,
              exit_location: savedData.exit_location || prev.exit_location,
              tas_staff_name: savedData.tas_staff_name || prev.tas_staff_name,
            }))
          }
        } catch (parseError) {
          console.error('Error parsing saved TR7 form data:', parseError)
        }
      }
    } catch (err) {
      console.error('Error loading saved TR7 form:', err)
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
        .eq('doc_type', 'TR7 Form')
        .maybeSingle()

      const formDataJson = JSON.stringify(formData)
      const fileName = `TR7_Form_Incident_${incident.id}_${new Date().toISOString().split('T')[0]}.json`

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
            doc_type: 'TR7 Form',
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
      console.error('Error saving TR7 form:', err)
      setSaveError(err.message || 'Failed to save TR7 form')
    } finally {
      setSaving(false)
    }
  }

  const handleExportWord = async () => {
    setExporting(true)
    setSaveError(null)

    try {
      const response = await fetch(`/api/incidents/${incident.id}/export-tr7`, {
        method: 'GET',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      const blob = await response.blob()
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `TR7_Incident_${incident.id}.docx`

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
      console.error('Error exporting TR7 document:', err)
      setSaveError(err.message || 'Failed to export TR7 document')
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
            TR7 Form - Passenger Exit Report
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
          TR7 Form - Passenger Exit Report
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="incident_date">Incident Date</Label>
              <Input
                id="incident_date"
                type="date"
                value={formData.incident_date}
                onChange={(e) => handleInputChange('incident_date', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="incident_time">Incident Time</Label>
              <Input
                id="incident_time"
                type="time"
                value={formData.incident_time}
                onChange={(e) => handleInputChange('incident_time', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="school_name">School Name</Label>
              <Input
                id="school_name"
                value={formData.school_name}
                onChange={(e) => handleInputChange('school_name', e.target.value)}
                placeholder="Enter school name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="passenger_names">Passenger Names</Label>
              <Input
                id="passenger_names"
                value={formData.passenger_names}
                onChange={(e) => handleInputChange('passenger_names', e.target.value)}
                placeholder="Enter passenger names (comma separated)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="passenger_ages">Passenger Ages</Label>
              <Input
                id="passenger_ages"
                value={formData.passenger_ages}
                onChange={(e) => handleInputChange('passenger_ages', e.target.value)}
                placeholder="Enter ages (comma separated)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="passenger_ethnicity">Passenger Ethnicity</Label>
              <Input
                id="passenger_ethnicity"
                value={formData.passenger_ethnicity}
                onChange={(e) => handleInputChange('passenger_ethnicity', e.target.value)}
                placeholder="Enter ethnicity (comma separated)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="operator_name">Operator Name</Label>
              <Input
                id="operator_name"
                value={formData.operator_name}
                onChange={(e) => handleInputChange('operator_name', e.target.value)}
                placeholder="Enter operator name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicle_number">Vehicle Number</Label>
              <Input
                id="vehicle_number"
                value={formData.vehicle_number}
                onChange={(e) => handleInputChange('vehicle_number', e.target.value)}
                placeholder="Enter vehicle number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="exit_location">Exit Location</Label>
              <Input
                id="exit_location"
                value={formData.exit_location}
                onChange={(e) => handleInputChange('exit_location', e.target.value)}
                placeholder="Enter exit location"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="distance_from_destination">Distance from Destination</Label>
              <Input
                id="distance_from_destination"
                value={formData.distance_from_destination}
                onChange={(e) => handleInputChange('distance_from_destination', e.target.value)}
                placeholder="Enter distance"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="prior_incidents">Prior Incidents</Label>
              <textarea
                id="prior_incidents"
                value={formData.prior_incidents}
                onChange={(e) => handleInputChange('prior_incidents', e.target.value)}
                placeholder="Describe any prior incidents"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="passenger_comments">Passenger Comments</Label>
              <textarea
                id="passenger_comments"
                value={formData.passenger_comments}
                onChange={(e) => handleInputChange('passenger_comments', e.target.value)}
                placeholder="Enter passenger comments"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="distinguishing_features">Distinguishing Features</Label>
              <textarea
                id="distinguishing_features"
                value={formData.distinguishing_features}
                onChange={(e) => handleInputChange('distinguishing_features', e.target.value)}
                placeholder="Describe distinguishing features of passengers"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="clothing_description">Clothing Description</Label>
              <textarea
                id="clothing_description"
                value={formData.clothing_description}
                onChange={(e) => handleInputChange('clothing_description', e.target.value)}
                placeholder="Describe clothing worn by passengers"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="school_uniform_details">School Uniform Details</Label>
              <textarea
                id="school_uniform_details"
                value={formData.school_uniform_details}
                onChange={(e) => handleInputChange('school_uniform_details', e.target.value)}
                placeholder="Describe school uniform details"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tas_staff_name">TAS Staff Name</Label>
              <Input
                id="tas_staff_name"
                value={formData.tas_staff_name}
                onChange={(e) => handleInputChange('tas_staff_name', e.target.value)}
                placeholder="Enter TAS staff name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tas_report_time">TAS Report Time</Label>
              <Input
                id="tas_report_time"
                value={formData.tas_report_time}
                onChange={(e) => handleInputChange('tas_report_time', e.target.value)}
                placeholder="DD/MM/YYYY HH:MM"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="police_reference_number">Police Reference Number</Label>
              <Input
                id="police_reference_number"
                value={formData.police_reference_number}
                onChange={(e) => handleInputChange('police_reference_number', e.target.value)}
                placeholder="Enter police reference number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="form_completed_by">Form Completed By</Label>
              <Input
                id="form_completed_by"
                value={formData.form_completed_by}
                onChange={(e) => handleInputChange('form_completed_by', e.target.value)}
                placeholder="Enter name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signature_name">Signature Name</Label>
              <Input
                id="signature_name"
                value={formData.signature_name}
                onChange={(e) => handleInputChange('signature_name', e.target.value)}
                placeholder="Enter signature name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="signature_date">Signature Date</Label>
              <Input
                id="signature_date"
                type="date"
                value={formData.signature_date}
                onChange={(e) => handleInputChange('signature_date', e.target.value)}
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
                <p className="text-sm text-green-700 mt-1">TR7 form saved successfully!</p>
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

