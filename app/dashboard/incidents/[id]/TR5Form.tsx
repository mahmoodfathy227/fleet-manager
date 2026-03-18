'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FileText, Save, CheckCircle, AlertCircle, FileDown } from 'lucide-react'
import { exportHTMLToPDF } from '@/lib/utils/pdfExport'

interface TR5FormProps {
  incident: {
    id: number
    incident_type: string | null
    description: string | null
    reported_at: string
    vehicles?: {
      id: number
      vehicle_identifier: string | null
      registration: string | null
      plate_number: string | null
    } | null
    routes?: {
      id: number
      route_number: string | null
    } | null
    route_sessions?: {
      id: number
      session_date: string
      session_type: string
      driver_id: number | null
      passenger_assistant_id: number | null
    } | Array<{
      id: number
      session_date: string
      session_type: string
      driver_id: number | null
      passenger_assistant_id: number | null
    }> | null
    incident_employees?: Array<{
      employees?: {
        id: number
        full_name: string | null
        role: string | null
      } | null
    }>
    incident_passengers?: Array<{
      passengers?: {
        id: number
        full_name: string | null
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

export default function TR5Form({ incident, driverInfo, paInfo }: TR5FormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const [formData, setFormData] = useState({
    dateOfIncident: incident.reported_at ? new Date(incident.reported_at).toISOString().split('T')[0] : '',
    timeOfIncident: incident.reported_at ? new Date(incident.reported_at).toTimeString().slice(0, 5) : '',
    dateFormCompleted: new Date().toISOString().split('T')[0],
    operator: '',
    establishment: '',
    driverName: driverInfo?.name || '',
    paName: paInfo?.name || '',
    vehicleReg: incident.vehicles?.registration || incident.vehicles?.plate_number || incident.vehicles?.vehicle_identifier || '',
    driverTASNumber: driverInfo?.tasNumber || '',
    paTASNumber: paInfo?.tasNumber || '',
    passengersInvolved: incident.incident_passengers?.map(ip => ip.passengers?.full_name).filter(Boolean).join(', ') || '',
    description: incident.description || '',
    photosAttached: false,
    personCompletingForm: '',
    witnessName: '',
    witnessSignature: '',
  })

  // Load saved TR5 form data if it exists
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
        .eq('doc_type', 'TR5 Form')
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Error loading saved form:', error)
      } else if (savedForm?.file_url) {
        try {
          // Parse the JSON data from file_url
          const savedData = typeof savedForm.file_url === 'string' 
            ? JSON.parse(savedForm.file_url)
            : savedForm.file_url

          if (savedData && typeof savedData === 'object') {
            setFormData(prev => ({
              ...prev,
              ...savedData,
              // Don't overwrite auto-populated fields if they're empty in saved data
              driverName: savedData.driverName || prev.driverName,
              paName: savedData.paName || prev.paName,
              vehicleReg: savedData.vehicleReg || prev.vehicleReg,
              driverTASNumber: savedData.driverTASNumber || prev.driverTASNumber,
              paTASNumber: savedData.paTASNumber || prev.paTASNumber,
            }))
          }
        } catch (parseError) {
          console.error('Error parsing saved form data:', parseError)
        }
      }
    } catch (err) {
      console.error('Error loading saved form:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleExportWord = async () => {
    setExporting(true)
    setSaveError(null)

    try {
      const response = await fetch(`/api/incidents/${incident.id}/export-tr5`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      // Verify content type
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('wordprocessingml')) {
        const text = await response.text()
        console.error('[TR5 Export] Unexpected content type:', contentType)
        console.error('[TR5 Export] Response text:', text.substring(0, 200))
        throw new Error('Server did not return a Word document. Please check that the TR5 template exists in templates/TR5.docx')
      }

      // Get the blob
      const blob = await response.blob()
      console.log(`[TR5 Export] Blob size: ${blob.size} bytes`)
      
      // Verify blob is not empty
      if (blob.size === 0) {
        throw new Error('Exported file is empty. Please check that the TR5 template exists and contains data.')
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `TR5_Incident_${incident.id}_${new Date().toISOString().split('T')[0]}.docx`
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '')
        }
      }
      
      console.log(`[TR5 Export] Downloading file: ${filename}`)

      // Create download link
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      link.style.display = 'none'
      
      // Append to body, click, and remove
      document.body.appendChild(link)
      link.click()
      
      // Clean up
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl)
        document.body.removeChild(link)
        console.log('[TR5 Export] Download completed')
      }, 100)

    } catch (error: any) {
      console.error('[TR5 Export] Export failed:', error)
      setSaveError(error.message || 'Failed to export TR5 form')
    } finally {
      setExporting(false)
    }
  }

  const handlePrintForm = async () => {
    const formatDate = (dateString: string) => {
      if (!dateString) return ''
      const date = new Date(dateString)
      return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }

    const formatTime = (timeString: string) => {
      if (!timeString) return ''
      return timeString
    }

    // Load the TR5 HTML template
    let templateHTML = ''
    try {
      const templateResponse = await fetch('/TR5-template.html')
      if (templateResponse.ok) {
        templateHTML = await templateResponse.text()
      } else {
        throw new Error('Template not found')
      }
    } catch (error) {
      console.error('Error loading TR5 template:', error)
      alert('Error loading TR5 template. Please ensure TR5-template.html is in the public folder.')
      return
    }

    // Create injection script with overlay approach for PDF-to-HTML conversion
    const injectionScript = `
    <style>
      .tr5-field-overlay {
        position: absolute;
        font-family: Arial, sans-serif;
        font-size: 11pt;
        color: #000;
        background: transparent;
        z-index: 1000;
        pointer-events: none;
        white-space: nowrap;
      }
      /* Position overlays based on TR5 form layout - adjust these to match your PDF */
      .tr5-date-incident { top: 185mm; left: 35mm; }
      .tr5-time-incident { top: 185mm; left: 85mm; }
      .tr5-date-completed { top: 185mm; left: 125mm; }
      .tr5-fps { top: 185mm; left: 175mm; }
      .tr5-operator { top: 200mm; left: 35mm; }
      .tr5-establishment { top: 200mm; left: 125mm; }
      .tr5-driver-name { top: 215mm; left: 35mm; }
      .tr5-pa-name { top: 215mm; left: 125mm; }
      .tr5-vehicle-reg { top: 230mm; left: 35mm; }
      .tr5-driver-tas { top: 245mm; left: 35mm; }
      .tr5-pa-tas { top: 245mm; left: 125mm; }
      .tr5-passengers { top: 260mm; left: 35mm; width: 170mm; white-space: normal; }
      .tr5-description { top: 280mm; left: 35mm; width: 170mm; min-height: 60mm; white-space: pre-wrap; }
      .tr5-person-completing { top: 265mm; left: 35mm; }
      .tr5-witness { top: 280mm; left: 35mm; }
      @media print {
        .tr5-field-overlay {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    </style>
    <script>
      (function() {
        try {
          const formData = ${JSON.stringify({
            dateOfIncident: formatDate(formData.dateOfIncident),
            timeOfIncident: formatTime(formData.timeOfIncident),
            dateFormCompleted: formatDate(formData.dateFormCompleted),
            operator: formData.operator,
            establishment: formData.establishment,
            driverName: formData.driverName,
            paName: formData.paName,
            vehicleReg: formData.vehicleReg,
            driverTASNumber: formData.driverTASNumber,
            paTASNumber: formData.paTASNumber,
            passengersInvolved: formData.passengersInvolved,
            description: formData.description,
            photosAttached: formData.photosAttached,
            personCompletingForm: formData.personCompletingForm,
            witnessName: formData.witnessName,
            fpsNumber: incident.routes?.route_number || ''
          })};
          
          function createOverlay(className, value) {
            if (!value) return
            const overlay = document.createElement('div')
            overlay.className = 'tr5-field-overlay ' + className
            overlay.textContent = value
            document.body.appendChild(overlay)
          }
          
          function findAndReplaceText(searchText, replaceText) {
            if (!replaceText) return false
            const walker = document.createTreeWalker(
              document.body,
              NodeFilter.SHOW_TEXT,
              null
            )
            let found = false
            let node
            while (node = walker.nextNode()) {
              if (node.textContent && node.textContent.includes(searchText)) {
                const parent = node.parentElement
                if (parent) {
                  node.textContent = node.textContent.replace(new RegExp(searchText + '[^\\n]*', 'gi'), searchText + ' ' + replaceText)
                  found = true
                }
              }
            }
            return found
          }
          
          function injectValues() {
            // First try to find and replace text if it exists in the HTML
            const textReplacements = [
              ['Date of incident:', formData.dateOfIncident],
              ['Time of incident:', formData.timeOfIncident],
              ['Date form completed:', formData.dateFormCompleted],
              ['FPS No:', formData.fpsNumber],
              ['Operator:', formData.operator],
              ['Establishment:', formData.establishment],
              ['Drivers Name:', formData.driverName],
              ['PA\'s Name(s):', formData.paName],
              ['Vehicle Reg:', formData.vehicleReg],
              ['Drivers TAS Number:', formData.driverTASNumber],
              ['PA\'s TAS Number(s):', formData.paTASNumber]
            ]
            
            // Try text replacement first
            textReplacements.forEach(([label, value]) => {
              if (!findAndReplaceText(label, value)) {
                // If text not found, create overlay
                const className = 'tr5-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/[^a-z0-9]$/, '')
                createOverlay(className, value)
              }
            })
            
            // Always create overlays for complex fields
            createOverlay('tr5-passengers', formData.passengersInvolved)
            createOverlay('tr5-description', formData.description)
            createOverlay('tr5-person-completing', formData.personCompletingForm)
            createOverlay('tr5-witness', formData.witnessName)
          }
          
          // Run injection when DOM is ready
          function runInjection() {
            injectValues()
          }
          
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', runInjection)
          } else {
            runInjection()
          }
          
          // Also run after a delay to ensure page is fully loaded
          setTimeout(runInjection, 500)
          setTimeout(runInjection, 1000)
        } catch (e) {
          console.error('Error injecting TR5 values:', e)
        }
      })()
    </script>
    `
    
    // Insert the injection script before closing body tag
    templateHTML = templateHTML.replace(/<\/body>/i, `${injectionScript}</body>`)
    
    const fileName = `TR5_Incident_${incident.id}_${new Date().toISOString().split('T')[0]}.pdf`
    exportHTMLToPDF(templateHTML, fileName)
  }

  const handleSaveForm = async () => {
    // Validate required fields
    if (!formData.dateOfIncident || !formData.timeOfIncident || !formData.description || !formData.personCompletingForm) {
      setSaveError('Please fill in all required fields (marked with *)')
      return
    }

    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        throw new Error('You must be logged in to save the form')
      }

      // Get user ID from users table
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser.email)
        .maybeSingle()

      // Check if a TR5 form already exists for this incident
      const { data: existingForm } = await supabase
        .from('documents')
        .select('id')
        .eq('owner_type', 'incident')
        .eq('owner_id', incident.id)
        .eq('doc_type', 'TR5 Form')
        .maybeSingle()

      const formDataJson = JSON.stringify(formData)
      const fileName = `TR5_Form_Incident_${incident.id}_${new Date().toISOString().split('T')[0]}.json`

      if (existingForm) {
        // Update existing form
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
        // Insert new form
        const { error: insertError } = await supabase
          .from('documents')
          .insert({
            owner_type: 'incident',
            owner_id: incident.id,
            file_url: formDataJson,
            file_name: fileName,
            file_type: 'application/json',
            file_path: fileName,
            doc_type: 'TR5 Form',
            uploaded_by: userData?.id || null,
          })

        if (insertError) throw insertError
      }

      setSaveSuccess(true)
      setTimeout(() => {
        setSaveSuccess(false)
        router.refresh()
      }, 2000)
    } catch (err: any) {
      console.error('Error saving TR5 form:', err)
      setSaveError(err.message || 'An error occurred while saving the form')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="bg-slate-50 border-b border-slate-100 py-2.5 px-4">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center">
          <FileText className="mr-2 h-4 w-4" />
          TR5 Incident Report Form
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Fields marked with <span className="text-red-500">*</span> are required. 
              Route and driver information has been auto-populated from the incident data.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dateOfIncident">
                Date of incident <span className="text-red-500">*</span>
              </Label>
              <Input
                id="dateOfIncident"
                type="date"
                required
                value={formData.dateOfIncident}
                onChange={(e) => handleInputChange('dateOfIncident', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timeOfIncident">
                Time of incident <span className="text-red-500">*</span>
              </Label>
              <Input
                id="timeOfIncident"
                type="time"
                required
                value={formData.timeOfIncident}
                onChange={(e) => handleInputChange('timeOfIncident', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFormCompleted">
                Date form completed <span className="text-red-500">*</span>
              </Label>
              <Input
                id="dateFormCompleted"
                type="date"
                required
                value={formData.dateFormCompleted}
                onChange={(e) => handleInputChange('dateFormCompleted', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="operator">Operator</Label>
              <Input
                id="operator"
                value={formData.operator}
                onChange={(e) => handleInputChange('operator', e.target.value)}
                placeholder="Enter operator name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="establishment">Establishment</Label>
              <Input
                id="establishment"
                value={formData.establishment}
                onChange={(e) => handleInputChange('establishment', e.target.value)}
                placeholder="Enter establishment name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="driverName">
                Driver&apos;s Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="driverName"
                required
                value={formData.driverName}
                onChange={(e) => handleInputChange('driverName', e.target.value)}
                className="bg-gray-50"
                readOnly
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paName">PA&apos;s Name(s)</Label>
              <Input
                id="paName"
                value={formData.paName}
                onChange={(e) => handleInputChange('paName', e.target.value)}
                className="bg-gray-50"
                readOnly
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vehicleReg">
                Vehicle Reg <span className="text-red-500">*</span>
              </Label>
              <Input
                id="vehicleReg"
                required
                value={formData.vehicleReg}
                onChange={(e) => handleInputChange('vehicleReg', e.target.value)}
                className="bg-gray-50"
                readOnly
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="driverTASNumber">
                Driver&apos;s TAS Number
              </Label>
              <Input
                id="driverTASNumber"
                value={formData.driverTASNumber}
                onChange={(e) => handleInputChange('driverTASNumber', e.target.value)}
                className="bg-gray-50"
                readOnly
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paTASNumber">PA&apos;s TAS Number(s)</Label>
              <Input
                id="paTASNumber"
                value={formData.paTASNumber}
                onChange={(e) => handleInputChange('paTASNumber', e.target.value)}
                className="bg-gray-50"
                readOnly
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="passengersInvolved">
                Passenger(s)/person(s) involved in the incident
              </Label>
              <Input
                id="passengersInvolved"
                value={formData.passengersInvolved}
                onChange={(e) => handleInputChange('passengersInvolved', e.target.value)}
                placeholder="Enter passenger names"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">
                Description of incident <span className="text-red-500">*</span>
              </Label>
              <textarea
                id="description"
                required
                rows={6}
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-navy focus:border-navy"
                placeholder="Provide a detailed description of the incident..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Continue on separate sheets as necessary
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="photosAttached">Are there photos to attach to the report?</Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="photosAttached"
                    checked={formData.photosAttached === true}
                    onChange={() => handleInputChange('photosAttached', true)}
                    className="mr-2"
                  />
                  Yes
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="photosAttached"
                    checked={formData.photosAttached === false}
                    onChange={() => handleInputChange('photosAttached', false)}
                    className="mr-2"
                  />
                  No
                </label>
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="personCompletingForm">
                Name of person completing the form <span className="text-red-500">*</span>
              </Label>
              <Input
                id="personCompletingForm"
                required
                value={formData.personCompletingForm}
                onChange={(e) => handleInputChange('personCompletingForm', e.target.value)}
                placeholder="Enter your name"
              />
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-gray-600 mb-4">
              <strong>I certify that this is an accurate account / record of the incident:</strong>
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="witnessName">Signature of person(s) who witnessed the incident (if different)</Label>
                <Input
                  id="witnessName"
                  value={formData.witnessName}
                  onChange={(e) => handleInputChange('witnessName', e.target.value)}
                  placeholder="Enter witness name"
                />
              </div>
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
                <p className="text-sm text-green-700 mt-1">TR5 form saved successfully!</p>
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
              variant="secondary"
              onClick={handlePrintForm}
              disabled={saving || loading || exporting}
            >
              Print Form
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

