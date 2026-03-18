'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ConfirmDeleteCard } from '@/components/ui/ConfirmDeleteCard'
import { ArrowLeft, Trash2, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react'
import Link from 'next/link'

type TabType = 'basic' | 'certificates' | 'documents' | 'maintenance' | 'seating' | 'notes'

function FileListSummary({ files, onClear }: { files: File[]; onClear: () => void }) {
  if (!files?.length) return null
  return (
    <p className="text-xs text-gray-500 mt-1">
      {files.length} file(s): {files.map(f => f.name).join(', ')}
      {' '}
      <button type="button" onClick={onClear} className="text-red-600 hover:underline">Clear</button>
    </p>
  )
}

function EditVehiclePageClient({ id }: { id: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drivers, setDrivers] = useState<Array<{ id: number; name: string }>>([])
  const [activeTab, setActiveTab] = useState<TabType>('basic')

  // File uploads state – each field holds an array to allow multiple files (e.g. policy + schedule for insurance)
  const [fileUploads, setFileUploads] = useState<{ [key: string]: File[] }>({
    registration_file: [],
    mot_file: [],
    insurance_file: [],
    taxi_badge_file: [],
    loler_file: [],
    first_aid_file: [],
    fire_extinguisher_file: [],
    tax_file: [],
    logbook_file: [],
    service_record_file: [],
    iva_file: [],
    lpg_safety_file: [],
    repair_document_file: [],
    interim_certificate_file: [],
    pmi_document_file: [],
  })

  const [formData, setFormData] = useState({
    vehicle_identifier: '',
    registration: '',
    registration_expiry_date: '',
    make: '',
    model: '',
    plate_number: '',
    colour: '',
    vehicle_type: '',
    vehicle_category: '',
    lpg_fuelled: false,
    ownership_type: '',
    council_assignment: '',
    mot_date: '',
    tax_date: '',
    insurance_expiry_date: '',
    tail_lift: false,
    loler_expiry_date: '',
    last_serviced: '',
    service_booked_day: '',
    first_aid_expiry: '',
    fire_extinguisher_expiry: '',
    taxi_licence_holder_id: '',
    spare_vehicle: false,
    off_the_road: false,
    assigned_to: '',
    notes: '',
    // Seating plan fields
    seating_plan_name: '',
    total_capacity: '',
    rows: '',
    seats_per_row: '',
    wheelchair_spaces: '',
    seating_notes: '',
    pmi_weeks: '',
    last_pmi_date: '',
  })

  useEffect(() => {
    async function loadDrivers() {
      const { data, error } = await supabase
        .from('drivers')
        .select('employee_id, employees(full_name, employment_status, can_work)')
        .order('employee_id')

      if (!error && data) {
        const driverList = data
          .filter((d: any) => d.employees?.employment_status === 'Active' && d.employees?.can_work !== false)
          .map((d: any) => ({
            id: d.employee_id,
            name: d.employees?.full_name || 'Unknown',
          }))
        setDrivers(driverList)
      }
    }

    loadDrivers()
  }, [supabase])

  const handleFileChange = (fieldName: string, files: FileList | null) => {
    setFileUploads(prev => ({
      ...prev,
      [fieldName]: files ? [...(prev[fieldName] || []), ...Array.from(files)] : [],
    }))
  }

  const handleNext = () => {
    const tabs: TabType[] = ['basic', 'certificates', 'documents', 'maintenance', 'seating', 'notes']
    const currentIndex = tabs.indexOf(activeTab)
    if (currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1])
    }
  }

  const handlePrevious = () => {
    const tabs: TabType[] = ['basic', 'certificates', 'documents', 'maintenance', 'seating', 'notes']
    const currentIndex = tabs.indexOf(activeTab)
    if (currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1])
    }
  }

  useEffect(() => {
    async function loadVehicle() {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        setError('Failed to load vehicle')
        return
      }

      if (data) {
        setFormData({
          vehicle_identifier: data.vehicle_identifier || '',
          registration: data.registration || '',
          registration_expiry_date: data.registration_expiry_date || '',
          make: data.make || '',
          model: data.model || '',
          plate_number: data.plate_number || '',
          colour: data.colour || '',
          vehicle_type: data.vehicle_type || '',
          vehicle_category: data.vehicle_category || '',
          lpg_fuelled: data.lpg_fuelled ?? false,
          ownership_type: data.ownership_type || '',
          council_assignment: data.council_assignment || '',
          mot_date: data.mot_date || '',
          tax_date: data.tax_date || '',
          insurance_expiry_date: data.insurance_expiry_date || '',
          tail_lift: data.tail_lift || false,
          loler_expiry_date: data.loler_expiry_date || '',
          last_serviced: data.last_serviced || '',
          service_booked_day: data.service_booked_day || '',
          first_aid_expiry: data.first_aid_expiry || '',
          fire_extinguisher_expiry: data.fire_extinguisher_expiry || '',
          taxi_licence_holder_id: data.taxi_licence_holder_id ? String(data.taxi_licence_holder_id) : '',
          spare_vehicle: data.spare_vehicle || false,
          off_the_road: data.off_the_road || false,
          assigned_to: data.assigned_to ? String(data.assigned_to) : '',
          notes: data.notes || '',
          // Seating plan fields - load from seating plan if exists
          seating_plan_name: '',
          total_capacity: '',
          rows: '',
          seats_per_row: '',
          wheelchair_spaces: '',
          seating_notes: '',
          pmi_weeks: data.pmi_weeks != null ? String(data.pmi_weeks) : '',
          last_pmi_date: data.last_pmi_date || '',
        })
        
        // Load seating plan if exists
        const { data: seatingData } = await supabase
          .from('vehicle_seating_plans')
          .select('*')
          .eq('vehicle_id', parseInt(id))
          .maybeSingle()
        
        if (seatingData) {
          setFormData(prev => ({
            ...prev,
            seating_plan_name: seatingData.name || '',
            total_capacity: String(seatingData.total_capacity || ''),
            rows: String(seatingData.rows || ''),
            seats_per_row: String(seatingData.seats_per_row || ''),
            wheelchair_spaces: String(seatingData.wheelchair_spaces || ''),
            seating_notes: seatingData.notes || '',
          }))
        }
      }
    }

    loadVehicle()
  }, [id, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Convert empty date strings to null
      // Exclude seating plan fields and file uploads from vehicle update
      const {
        seating_plan_name,
        total_capacity,
        rows,
        seats_per_row,
        wheelchair_spaces,
        seating_notes,
        ...vehicleFields
      } = formData

      // Convert empty strings to null for optional fields
      const cleanValue = (val: string) => (val === '' ? null : val)
      
      const dataToUpdate: any = {
        vehicle_identifier: cleanValue(formData.vehicle_identifier),
        registration: cleanValue(formData.registration),
        make: cleanValue(formData.make),
        model: cleanValue(formData.model),
        plate_number: cleanValue(formData.plate_number),
        colour: cleanValue(formData.colour),
        vehicle_type: cleanValue(formData.vehicle_type),
        vehicle_category: cleanValue(formData.vehicle_category),
        lpg_fuelled: formData.lpg_fuelled,
        registration_expiry_date: formData.registration_expiry_date || null,
        mot_date: formData.mot_date || null,
        tax_date: formData.tax_date || null,
        insurance_expiry_date: formData.insurance_expiry_date || null,
        tail_lift: formData.tail_lift,
        loler_expiry_date: formData.loler_expiry_date || null,
        last_serviced: formData.last_serviced || null,
        service_booked_day: formData.service_booked_day || null,
        first_aid_expiry: formData.first_aid_expiry || null,
        fire_extinguisher_expiry: formData.fire_extinguisher_expiry || null,
        ownership_type: formData.ownership_type || null,
        council_assignment: formData.council_assignment || null,
        spare_vehicle: formData.spare_vehicle,
        off_the_road: formData.off_the_road,
        assigned_to: formData.assigned_to ? parseInt(formData.assigned_to) : null,
        taxi_licence_holder_id: formData.taxi_licence_holder_id ? parseInt(formData.taxi_licence_holder_id) : null,
        pmi_weeks: formData.vehicle_type === 'PSV' && formData.pmi_weeks ? parseInt(formData.pmi_weeks, 10) : null,
        last_pmi_date: formData.vehicle_type === 'PSV' && formData.last_pmi_date ? formData.last_pmi_date : null,
        notes: cleanValue(formData.notes),
      }

      // Check for duplicate registration if registration is provided
      if (dataToUpdate.registration) {
        const { data: existingVehicle, error: checkError } = await supabase
          .from('vehicles')
          .select('id, registration')
          .eq('registration', dataToUpdate.registration)
          .neq('id', parseInt(id))
          .maybeSingle()

        if (checkError) {
          throw new Error(`Error checking for duplicate registration: ${checkError.message}`)
        }

        if (existingVehicle) {
          throw new Error(`A vehicle with registration "${dataToUpdate.registration}" already exists (Vehicle ID: ${existingVehicle.id})`)
        }
      }

      const { error: updateError } = await supabase
        .from('vehicles')
        .update(dataToUpdate)
        .eq('id', id)

      if (updateError) {
        // Check if it's a unique constraint violation
        if (updateError.code === '23505' || updateError.message.includes('unique')) {
          throw new Error(`A vehicle with registration "${dataToUpdate.registration}" already exists`)
        }
        throw updateError
      }

      // Upload files to Supabase Storage
      const uploadedDocuments: Array<{
        fileUrl: string
        fileName: string
        fileType: string
        docType: string
        filePath: string
      }> = []

      const uploadErrors: string[] = []

      // Map file keys to document types (must match VehicleComplianceDocuments.tsx)
      const fileKeyToDocType: { [key: string]: string } = {
        registration_file: 'Vehicle Plate Certificate',
        mot_file: 'MOT Certificate',
        insurance_file: 'Vehicle Insurance Certificate',
        taxi_badge_file: 'Taxi Badge',
        loler_file: 'LOLER Certificate',
        first_aid_file: 'First Aid Kit Certificate',
        fire_extinguisher_file: 'Fire Extinguisher Certificate',
        tax_file: 'Vehicle Tax Certificate',
        logbook_file: 'Logbook',
        service_record_file: 'Service Record',
        iva_file: 'IVA Certificate',
        lpg_safety_file: 'LPG Safety Check',
        repair_document_file: 'Repair Invoice',
        interim_certificate_file: 'Interim Service Certificate',
        pmi_document_file: 'PMI Document',
      }

      const fileKeyToDocTypeOld: { [key: string]: string } = {
        registration_file: 'Vehicle Plate Certificate',
        mot_file: 'MOT Certificate',
        insurance_file: 'Vehicle Insurance Certificate',
        taxi_badge_file: 'Taxi Badge',
        loler_file: 'LOLER Certificate',
        first_aid_file: 'First Aid Kit Certificate',
        fire_extinguisher_file: 'Fire Extinguisher Certificate',
        tax_file: 'Vehicle Tax Certificate',
        logbook_file: 'Logbook',
        service_record_file: 'Service Record',
      }

      const filesToUpload = Object.entries(fileUploads).filter(([_, files]) => (Array.isArray(files) ? files : []).length > 0)
      console.log('Files to upload:', filesToUpload.length, filesToUpload.map(([key]) => key))

      for (const [key, files] of Object.entries(fileUploads)) {
        const list = Array.isArray(files) ? files : (files ? [files] : [])
        for (let i = 0; i < list.length; i++) {
          const file = list[i]
          if (!file) continue
          console.log(`Processing file upload: ${key} - ${file.name}`)
          try {
            const fileExt = file.name.split('.').pop()
            const fileName = `vehicles/${id}/${key}_${Date.now()}_${i}.${fileExt}`

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('VEHICLE_DOCUMENTS')
              .upload(fileName, file)

            if (uploadError) {
              console.error(`Error uploading file ${file.name}:`, uploadError)
              uploadErrors.push(`Failed to upload ${file.name}: ${uploadError.message}`)
              continue
            }

            if (uploadData) {
              const { data: { publicUrl } } = supabase.storage
                .from('VEHICLE_DOCUMENTS')
                .getPublicUrl(fileName)

              console.log(`File uploaded successfully: ${file.name} -> ${fileName}`)

              uploadedDocuments.push({
                fileUrl: publicUrl,
                fileName: file.name,
                fileType: file.type || 'application/octet-stream',
                docType: fileKeyToDocType[key] || 'Certificate',
                filePath: fileName,
              })
            }
          } catch (err: any) {
            console.error(`Error processing file ${file.name}:`, err)
            uploadErrors.push(`Failed to process ${file.name}: ${err.message || 'Unknown error'}`)
          }
        }
      }

      // Create document records and link to vehicle via document_vehicle_links
      if (uploadedDocuments.length > 0) {
        for (const doc of uploadedDocuments) {
          try {
            const { data: docRow, error: docErr } = await supabase
              .from('documents')
              .insert({
                file_url: JSON.stringify([doc.fileUrl]),
                file_name: doc.fileName,
                file_type: doc.fileType,
                file_path: doc.filePath,
                doc_type: doc.docType,
                uploaded_at: new Date().toISOString(),
              })
              .select('id')
              .single()
            
            if (docErr) {
              console.error('Error creating document record:', docErr)
              uploadErrors.push(`Failed to save ${doc.fileName}: ${docErr.message}`)
              continue
            }
            
            if (docRow?.id) {
              console.log(`Creating document link for ${doc.fileName} (doc_id: ${docRow.id}, vehicle_id: ${id})`)
              const { error: linkErr } = await supabase.from('document_vehicle_links').insert({
                document_id: docRow.id,
                vehicle_id: parseInt(id),
              })
              
              if (linkErr) {
                console.error('Error linking document to vehicle:', linkErr)
                uploadErrors.push(`Failed to link ${doc.fileName} to vehicle: ${linkErr.message}`)
              } else {
                console.log(`Successfully linked document ${doc.fileName} to vehicle ${id}`)
              }
            } else {
              console.error(`No document ID returned for ${doc.fileName}`)
              uploadErrors.push(`Failed to get document ID for ${doc.fileName}`)
            }
          } catch (err: any) {
            console.error(`Error saving document ${doc.fileName}:`, err)
            uploadErrors.push(`Failed to save ${doc.fileName}: ${err.message || 'Unknown error'}`)
          }
        }
      }

      // Show warning if there were upload errors but don't fail the entire update
      if (uploadErrors.length > 0) {
        console.warn('Some documents failed to upload:', uploadErrors)
        setError(`Vehicle updated successfully, but ${uploadErrors.length} document(s) failed to upload: ${uploadErrors.join('; ')}`)
        // Note: We continue with the update even if some documents fail
      } else if (uploadedDocuments.length > 0) {
        // Success message for document uploads
        console.log(`Successfully uploaded and linked ${uploadedDocuments.length} document(s)`)
      } else if (filesToUpload.length > 0) {
        console.warn(`No documents were uploaded despite ${filesToUpload.length} file(s) selected`)
        setError('Vehicle updated successfully, but documents were not uploaded. Please check console for details.')
      }

      // Update seating plan if provided
      if (formData.seating_plan_name && formData.total_capacity && formData.rows && formData.seats_per_row) {
        try {
          await fetch(`/api/vehicles/${id}/seating`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: formData.seating_plan_name,
              total_capacity: parseInt(formData.total_capacity),
              rows: parseInt(formData.rows),
              seats_per_row: parseInt(formData.seats_per_row),
              wheelchair_spaces: parseInt(formData.wheelchair_spaces) || 0,
              notes: formData.seating_notes || null,
            }),
          })
        } catch (seatingError) {
          console.error('Error updating seating plan:', seatingError)
        }
      }

      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'vehicles',
          record_id: parseInt(id),
          action: 'UPDATE',
        }),
      })

      router.push(`/dashboard/vehicles/${id}`)
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
      const { error: deleteErr } = await supabase.from('vehicles').delete().eq('id', id)

      if (deleteErr) throw deleteErr

      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'vehicles',
          record_id: parseInt(id),
          action: 'DELETE',
        }),
      })

      router.push('/dashboard/vehicles')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setDeleting(false)
    }
  }

  const vehicleDisplayName =
    formData.registration || formData.vehicle_identifier || formData.plate_number || 'this vehicle'

  return (
    <div className="space-y-6">
      {showDeleteConfirm && (
        <ConfirmDeleteCard
          entityName={vehicleDisplayName}
          items={[
            'The vehicle record',
            'All compliance documents and certificates',
            'All document links',
            'All assignment and maintenance history',
          ]}
          confirmLabel="Yes, Delete Vehicle"
          onConfirm={handleDelete}
          onCancel={() => {
            setShowDeleteConfirm(false)
            setError(null)
          }}
          loading={deleting}
          error={error}
        />
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href={`/dashboard/vehicles/${id}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Vehicle</h1>
            <p className="mt-2 text-sm text-gray-600">Update vehicle information</p>
          </div>
        </div>
        <Button
          variant="danger"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleting}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>

      {error && !showDeleteConfirm && (
        <Card className="border-l-4 border-red-500 bg-red-50">
          <CardContent className="py-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Form sections">
          {[
            { id: 'basic', label: '🚗 Basic Info', icon: '🚗' },
            { id: 'certificates', label: '📜 Certificates', icon: '📜' },
            { id: 'documents', label: '📄 Documents', icon: '📄' },
            { id: 'maintenance', label: '🔧 Maintenance & Status', icon: '🔧' },
            { id: 'seating', label: '🪑 Seating Plan', icon: '🪑' },
            { id: 'notes', label: '📝 Notes', icon: '📝' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`
                border-b-2 px-1 py-3 text-sm font-medium transition-colors
                ${activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6" lang="en-GB">
        {/* Basic Info Tab */}
        {activeTab === 'basic' && (
          <Card>
            <CardHeader className="bg-slate-50 border-b border-slate-200 py-3">
              <CardTitle className="text-slate-900 text-base font-semibold">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="vehicle_identifier">Vehicle Identifier</Label>
                  <Input
                    id="vehicle_identifier"
                    value={formData.vehicle_identifier}
                    onChange={(e) =>
                      setFormData({ ...formData, vehicle_identifier: e.target.value })
                    }
                    placeholder="e.g., VEH-001"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registration">Registration</Label>
                  <Input
                    id="registration"
                    value={formData.registration}
                    onChange={(e) =>
                      setFormData({ ...formData, registration: e.target.value })
                    }
                    placeholder="e.g., AB12 CDE"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="plate_number">Plate Number</Label>
                  <Input
                    id="plate_number"
                    value={formData.plate_number}
                    onChange={(e) =>
                      setFormData({ ...formData, plate_number: e.target.value })
                    }
                    placeholder="e.g., AB12 CDE"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="make">Make</Label>
                  <Input
                    id="make"
                    value={formData.make}
                    onChange={(e) =>
                      setFormData({ ...formData, make: e.target.value })
                    }
                    placeholder="e.g., Ford, Mercedes"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) =>
                      setFormData({ ...formData, model: e.target.value })
                    }
                    placeholder="e.g., Transit, Sprinter"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="colour">Colour</Label>
                  <Input
                    id="colour"
                    value={formData.colour}
                    onChange={(e) =>
                      setFormData({ ...formData, colour: e.target.value })
                    }
                    placeholder="e.g., Red, Blue, White"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicle_type">Vehicle Type</Label>
                  <Select
                    id="vehicle_type"
                    value={formData.vehicle_type}
                    onChange={(e) =>
                      setFormData({ ...formData, vehicle_type: e.target.value })
                    }
                  >
                    <option value="">Select type</option>
                    <option value="PHV">PHV (Private Hire / Taxi)</option>
                    <option value="PSV">PSV (Public Service Vehicle)</option>
                  </Select>
                  <p className="text-xs text-slate-500">PHV: taxi licence, MOT, LOLER. PSV: PMI.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicle_category">Vehicle Category</Label>
                  <Select
                    id="vehicle_category"
                    value={formData.vehicle_category}
                    onChange={(e) =>
                      setFormData({ ...formData, vehicle_category: e.target.value })
                    }
                  >
                    <option value="">Select category</option>
                    <option value="M1">M1 (Passenger Vehicles)</option>
                    <option value="N1">N1 (Goods Vehicles)</option>
                    <option value="Jackeny">Jackeny</option>
                  </Select>
                  <p className="text-xs text-slate-500">M1: Passenger vehicles. N1: Goods vehicles. Jackeny: internal custom category.</p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="lpg_fuelled"
                      checked={formData.lpg_fuelled}
                      onChange={(e) =>
                        setFormData({ ...formData, lpg_fuelled: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="lpg_fuelled">LPG fuelled vehicle</Label>
                  </div>
                  <p className="text-xs text-slate-500">If checked, LPG safety check documents will be required in Compliance.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ownership_type">Ownership Type</Label>
                  <Select
                    id="ownership_type"
                    value={formData.ownership_type}
                    onChange={(e) =>
                      setFormData({ ...formData, ownership_type: e.target.value })
                    }
                  >
                    <option value="">Select type</option>
                    <option value="County Cars">County Cars</option>
                    <option value="NBT">NBT</option>
                    <option value="Privately Owned">Privately Owned</option>
                    <option value="Leased">Leased</option>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="council_assignment">Council Assignment</Label>
                  <Input
                    id="council_assignment"
                    value={formData.council_assignment}
                    onChange={(e) =>
                      setFormData({ ...formData, council_assignment: e.target.value })
                    }
                    placeholder="e.g., Council name or reference"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons for Basic Info */}
        {activeTab === 'basic' && (
          <Card>
            <CardContent className="pt-4">
              <div className="flex justify-end gap-3">
                <Link href={`/dashboard/vehicles/${id}`}>
                  <Button type="button" variant="outline" className="text-slate-600 border-slate-300 hover:bg-slate-50">
                    Cancel
                  </Button>
                </Link>
                <Button type="button" onClick={handleNext}>
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Certificates Tab */}
        {activeTab === 'certificates' && (
          <Card>
            <CardHeader className="bg-slate-50 border-b border-slate-200 py-3">
              <CardTitle className="text-slate-900 text-base font-semibold">Certificates & Expiry Dates</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Plate */}
                <div className="space-y-3 p-3 border rounded-lg">
                  <h3 className="font-semibold text-slate-700 text-sm">Plate Expiry</h3>
                  <div>
                    <Label htmlFor="registration_expiry_date">Plate Expiry</Label>
                    <Input
                      id="registration_expiry_date"
                      type="date"
                      value={formData.registration_expiry_date}
                      onChange={(e) =>
                        setFormData({ ...formData, registration_expiry_date: e.target.value })
                      }
                      max="9999-12-31"
                    />
                  </div>
                  <div>
                    <Label htmlFor="registration_file">Upload Plate Certificate(s)</Label>
                    <input
                      type="file"
                      id="registration_file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileChange('registration_file', e.target.files)}
                      className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm"
                    />
                    <FileListSummary files={fileUploads.registration_file} onClear={() => handleFileChange('registration_file', null)} />
                  </div>
                </div>

                {/* PHV: MOT */}
                {formData.vehicle_type === 'PHV' && (
                <div className="space-y-3 p-3 border rounded-lg">
                  <h3 className="font-semibold text-slate-700 text-sm">MOT Certificate</h3>
                  <div>
                    <Label htmlFor="mot_date">Expiry Date</Label>
                    <Input
                      id="mot_date"
                      type="date"
                      value={formData.mot_date}
                      onChange={(e) =>
                        setFormData({ ...formData, mot_date: e.target.value })
                      }
                      max="9999-12-31"
                    />
                  </div>
                  <div>
                    <Label htmlFor="mot_file">Upload Certificate(s)</Label>
                    <input
                      type="file"
                      id="mot_file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileChange('mot_file', e.target.files)}
                      className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm"
                    />
                    <FileListSummary files={fileUploads.mot_file} onClear={() => handleFileChange('mot_file', null)} />
                  </div>
                </div>
                )}

                {/* Tax */}
                <div className="space-y-3 p-3 border rounded-lg">
                  <h3 className="font-semibold text-slate-700 text-sm">Tax Certificate</h3>
                  <div>
                    <Label htmlFor="tax_date">Expiry date</Label>
                    <Input
                      id="tax_date"
                      type="date"
                      value={formData.tax_date}
                      onChange={(e) =>
                        setFormData({ ...formData, tax_date: e.target.value })
                      }
                      max="9999-12-31"
                    />
                  </div>
                  <div>
                    <Label htmlFor="tax_file">Upload Certificate(s)</Label>
                    <input
                      type="file"
                      id="tax_file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileChange('tax_file', e.target.files)}
                      className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm"
                    />
                    <FileListSummary files={fileUploads.tax_file} onClear={() => handleFileChange('tax_file', null)} />
                  </div>
                </div>

                {/* Insurance */}
                <div className="space-y-3 p-3 border rounded-lg">
                  <h3 className="font-semibold text-slate-700 text-sm">Vehicle Insurance</h3>
                  <div>
                    <Label htmlFor="insurance_expiry_date">Expiry Date</Label>
                    <Input
                      id="insurance_expiry_date"
                      type="date"
                      value={formData.insurance_expiry_date}
                      onChange={(e) =>
                        setFormData({ ...formData, insurance_expiry_date: e.target.value })
                      }
                      max="9999-12-31"
                    />
                  </div>
                  <div>
                    <Label htmlFor="insurance_file">Upload Policy / Schedule (multiple)</Label>
                    <input
                      type="file"
                      id="insurance_file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileChange('insurance_file', e.target.files)}
                      className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm"
                    />
                    <FileListSummary files={fileUploads.insurance_file} onClear={() => handleFileChange('insurance_file', null)} />
                  </div>
                </div>

                {/* N1: IVA Certificate */}
                {formData.vehicle_category === 'N1' && (
                <div className="space-y-3 p-3 border rounded-lg">
                  <h3 className="font-semibold text-slate-700 text-sm">IVA Certificate</h3>
                  <div>
                    <Label htmlFor="iva_file">Upload IVA Certificate(s)</Label>
                    <input
                      type="file"
                      id="iva_file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileChange('iva_file', e.target.files)}
                      className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm"
                    />
                    <FileListSummary files={fileUploads.iva_file} onClear={() => handleFileChange('iva_file', null)} />
                  </div>
                </div>
                )}

                {/* LPG: Safety Check */}
                {formData.lpg_fuelled && (
                <div className="space-y-3 p-3 border rounded-lg">
                  <h3 className="font-semibold text-slate-700 text-sm">LPG Safety Check</h3>
                  <div>
                    <Label htmlFor="lpg_safety_file">Upload LPG Safety Check document(s)</Label>
                    <input
                      type="file"
                      id="lpg_safety_file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileChange('lpg_safety_file', e.target.files)}
                      className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm"
                    />
                    <FileListSummary files={fileUploads.lpg_safety_file} onClear={() => handleFileChange('lpg_safety_file', null)} />
                  </div>
                </div>
                )}

                {/* PHV: LOLER */}
                {formData.vehicle_type === 'PHV' && (
                <div className="space-y-3 p-3 border rounded-lg">
                  <h3 className="font-semibold text-slate-700 text-sm">LOLER Certificate</h3>
                  <div>
                    <Label htmlFor="loler_expiry_date">Expiry Date</Label>
                    <Input
                      id="loler_expiry_date"
                      type="date"
                      value={formData.loler_expiry_date}
                      onChange={(e) =>
                        setFormData({ ...formData, loler_expiry_date: e.target.value })
                      }
                      max="9999-12-31"
                    />
                  </div>
                  <div>
                    <Label htmlFor="loler_file">Upload Certificate(s)</Label>
                    <input
                      type="file"
                      id="loler_file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileChange('loler_file', e.target.files)}
                      className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm"
                    />
                    <FileListSummary files={fileUploads.loler_file} onClear={() => handleFileChange('loler_file', null)} />
                  </div>
                </div>
                )}

                {/* PSV: PMI */}
                {formData.vehicle_type === 'PSV' && (
                <div className="space-y-4 p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
                  <h3 className="font-semibold text-slate-800 text-sm">PSV – PMI</h3>
                  <p className="text-xs text-slate-600">Next due is calculated from last PMI date + interval (weeks).</p>
                  <div>
                    <Label htmlFor="pmi_weeks">Interval (weeks between checks)</Label>
                    <Input
                      id="pmi_weeks"
                      type="number"
                      min={1}
                      max={52}
                      value={formData.pmi_weeks}
                      onChange={(e) =>
                        setFormData({ ...formData, pmi_weeks: e.target.value })
                      }
                      placeholder="e.g. 4"
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_pmi_date">Last PMI date</Label>
                    <Input
                      id="last_pmi_date"
                      type="date"
                      value={formData.last_pmi_date}
                      onChange={(e) =>
                        setFormData({ ...formData, last_pmi_date: e.target.value })
                      }
                      max="9999-12-31"
                    />
                  </div>
                </div>
                )}

                {/* First Aid */}
                <div className="space-y-3 p-3 border rounded-lg">
                  <h3 className="font-semibold text-slate-700 text-sm">First Aid Certificate</h3>
                  <div>
                    <Label htmlFor="first_aid_expiry">Expiry Date</Label>
                    <Input
                      id="first_aid_expiry"
                      type="date"
                      value={formData.first_aid_expiry}
                      onChange={(e) =>
                        setFormData({ ...formData, first_aid_expiry: e.target.value })
                      }
                      max="9999-12-31"
                    />
                  </div>
                  <div>
                    <Label htmlFor="first_aid_file">Upload Certificate(s)</Label>
                    <input
                      type="file"
                      id="first_aid_file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileChange('first_aid_file', e.target.files)}
                      className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm"
                    />
                    <FileListSummary files={fileUploads.first_aid_file} onClear={() => handleFileChange('first_aid_file', null)} />
                  </div>
                </div>

                {/* Fire Extinguisher */}
                <div className="space-y-3 p-3 border rounded-lg">
                  <h3 className="font-semibold text-slate-700 text-sm">Fire Extinguisher Certificate</h3>
                  <div>
                    <Label htmlFor="fire_extinguisher_expiry">Expiry Date</Label>
                    <Input
                      id="fire_extinguisher_expiry"
                      type="date"
                      value={formData.fire_extinguisher_expiry}
                      onChange={(e) =>
                        setFormData({ ...formData, fire_extinguisher_expiry: e.target.value })
                      }
                      max="9999-12-31"
                    />
                  </div>
                  <div>
                    <Label htmlFor="fire_extinguisher_file">Upload Certificate(s)</Label>
                    <input
                      type="file"
                      id="fire_extinguisher_file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => handleFileChange('fire_extinguisher_file', e.target.files)}
                      className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm"
                    />
                    <FileListSummary files={fileUploads.fire_extinguisher_file} onClear={() => handleFileChange('fire_extinguisher_file', null)} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons for Certificates */}
        {activeTab === 'certificates' && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between space-x-4">
                <Button type="button" variant="outline" onClick={handlePrevious} className="text-slate-600 border-slate-300 hover:bg-slate-50">
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                <div className="flex space-x-4">
                  <Link href={`/dashboard/vehicles/${id}`}>
                    <Button type="button" variant="outline" className="text-slate-600 border-slate-300 hover:bg-slate-50">
                      Cancel
                    </Button>
                  </Link>
                  <Button type="button" onClick={handleNext}>
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <Card>
            <CardHeader className="bg-slate-50 border-b border-slate-200 py-3">
              <CardTitle className="text-slate-900 text-base font-semibold">Additional Documents</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <p className="text-sm text-gray-600">
                Upload additional vehicle documents such as logbook, service records, repair invoices, and other relevant paperwork.
              </p>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="logbook_file">Vehicle logbook</Label>
                  <input
                    type="file"
                    id="logbook_file"
                    multiple
                    accept=".pdf,application/pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileChange('logbook_file', e.target.files)}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm"
                  />
                  <FileListSummary files={fileUploads.logbook_file} onClear={() => handleFileChange('logbook_file', null)} />
                  <p className="text-xs text-gray-500">Upload vehicle logbook (usually a PDF). Multiple files allowed.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="service_record_file">Service Record</Label>
                  <input
                    type="file"
                    id="service_record_file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileChange('service_record_file', e.target.files)}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm"
                  />
                  <FileListSummary files={fileUploads.service_record_file} onClear={() => handleFileChange('service_record_file', null)} />
                  <p className="text-xs text-gray-500">Upload service history records (PDF, JPG, PNG). Multiple files allowed.</p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="repair_document_file">Repair / Parts invoice</Label>
                  <input
                    type="file"
                    id="repair_document_file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => handleFileChange('repair_document_file', e.target.files)}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm"
                  />
                  <FileListSummary files={fileUploads.repair_document_file} onClear={() => handleFileChange('repair_document_file', null)} />
                  <p className="text-xs text-gray-500">Invoices relating to repairs or parts for this vehicle. Multiple files allowed. More can be added in Compliance documents.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons for Documents */}
        {activeTab === 'documents' && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between space-x-4">
                <Button type="button" variant="outline" onClick={handlePrevious} className="text-slate-600 border-slate-300 hover:bg-slate-50">
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                <div className="flex space-x-4">
                  <Link href={`/dashboard/vehicles/${id}`}>
                    <Button type="button" variant="outline" className="text-slate-600 border-slate-300 hover:bg-slate-50">
                      Cancel
                    </Button>
                  </Link>
                  <Button type="button" onClick={handleNext}>
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Maintenance & Status Tab */}
        {activeTab === 'maintenance' && (
          <Card>
            <CardHeader className="bg-slate-50 border-b border-slate-200 py-3">
              <CardTitle className="text-slate-900 text-base font-semibold">Maintenance & Status</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              {/* Vehicle type indicator – makes PHV vs PSV obvious */}
              <div className="rounded-lg border-2 border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Vehicle type (set in Basic)</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="maintenance_vehicle_type"
                      checked={formData.vehicle_type === 'PHV'}
                      onChange={() => setFormData({ ...formData, vehicle_type: 'PHV' })}
                      className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                    />
                    <span className="font-semibold text-slate-800">PHV</span>
                    <span className="text-sm text-slate-500">(Private Hire / Taxi)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="maintenance_vehicle_type"
                      checked={formData.vehicle_type === 'PSV'}
                      onChange={() => setFormData({ ...formData, vehicle_type: 'PSV' })}
                      className="h-4 w-4 text-primary border-gray-300 focus:ring-primary"
                    />
                    <span className="font-semibold text-slate-800">PSV</span>
                    <span className="text-sm text-slate-500">(Public Service Vehicle)</span>
                  </label>
                </div>
              </div>

              {/* PHV – Interim service */}
              {formData.vehicle_type === 'PHV' && (
                <div className="rounded-xl border-2 border-blue-100 bg-blue-50/50 p-4 space-y-4">
                  <h3 className="text-base font-semibold text-slate-900 border-b border-blue-200 pb-2">PHV – Interim service</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="last_serviced">Last Service Date</Label>
                      <Input
                        id="last_serviced"
                        type="date"
                        value={formData.last_serviced}
                        onChange={(e) => setFormData({ ...formData, last_serviced: e.target.value })}
                        max="9999-12-31"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="service_booked_day">Next Interim Service Due</Label>
                      <Input
                        id="service_booked_day"
                        type="date"
                        value={formData.service_booked_day}
                        onChange={(e) => setFormData({ ...formData, service_booked_day: e.target.value })}
                        max="9999-12-31"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="interim_certificate_file">Upload interim certificates</Label>
                      <input
                        type="file"
                        id="interim_certificate_file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange('interim_certificate_file', e.target.files)}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm border border-slate-200 rounded-lg p-2 bg-white"
                      />
                      <FileListSummary files={fileUploads.interim_certificate_file} onClear={() => handleFileChange('interim_certificate_file', null)} />
                      <p className="text-xs text-slate-500">Interim service certificates (PDF, JPG, PNG). Multiple files allowed.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* PSV – PMI */}
              {formData.vehicle_type === 'PSV' && (
                <div className="rounded-xl border-2 border-amber-100 bg-amber-50/50 p-4 space-y-4">
                  <h3 className="text-base font-semibold text-slate-900 border-b border-amber-200 pb-2">PSV – PMI</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="last_pmi_date">Last PMI date</Label>
                      <Input
                        id="last_pmi_date"
                        type="date"
                        value={formData.last_pmi_date}
                        onChange={(e) => setFormData({ ...formData, last_pmi_date: e.target.value })}
                        max="9999-12-31"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pmi_weeks">PMI interval (weeks)</Label>
                      <Input
                        id="pmi_weeks"
                        type="number"
                        min={1}
                        max={52}
                        value={formData.pmi_weeks}
                        onChange={(e) => setFormData({ ...formData, pmi_weeks: e.target.value })}
                        placeholder="e.g. 4"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <p className="text-xs font-medium text-slate-500">Next PMI due</p>
                      <p className="text-sm text-slate-900">
                        {formData.last_pmi_date && formData.pmi_weeks
                          ? (() => {
                              const d = new Date(formData.last_pmi_date)
                              d.setDate(d.getDate() + parseInt(formData.pmi_weeks, 10) * 7)
                              return d.toISOString().split('T')[0]
                            })()
                          : '— Set last PMI date and interval above'}
                      </p>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="pmi_document_file">Upload PMI documents</Label>
                      <input
                        type="file"
                        id="pmi_document_file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange('pmi_document_file', e.target.files)}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm border border-slate-200 rounded-lg p-2 bg-white"
                      />
                      <FileListSummary files={fileUploads.pmi_document_file} onClear={() => handleFileChange('pmi_document_file', null)} />
                      <p className="text-xs text-slate-500">PMI certificates / documents (PDF, JPG, PNG). Multiple files allowed.</p>
                    </div>
                  </div>
                </div>
              )}

              {formData.vehicle_type !== 'PHV' && formData.vehicle_type !== 'PSV' && (
                <p className="text-sm text-slate-500 italic">Select PHV or PSV above to see maintenance fields.</p>
              )}

              <div className="grid gap-6 md:grid-cols-2 pt-2 border-t border-slate-200">
                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="tail_lift"
                      checked={formData.tail_lift}
                      onChange={(e) =>
                        setFormData({ ...formData, tail_lift: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="tail_lift">Tail Lift</Label>
                  </div>
                </div>

                {formData.tail_lift && (
                  <div className="space-y-4 p-4 border rounded-lg md:col-span-2">
                    <h3 className="font-semibold text-slate-700 text-sm">LOLER Certificate</h3>
                    <div>
                      <Label htmlFor="loler_expiry_date">
                        Expiry Date
                      </Label>
                      <Input
                        id="loler_expiry_date"
                        type="date"
                        value={formData.loler_expiry_date}
                        onChange={(e) =>
                          setFormData({ ...formData, loler_expiry_date: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="loler_file_maint">Upload Certificate(s)</Label>
                      <input
                        type="file"
                        id="loler_file_maint"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => handleFileChange('loler_file', e.target.files)}
                        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm"
                      />
                      <FileListSummary files={fileUploads.loler_file} onClear={() => handleFileChange('loler_file', null)} />
                    </div>
                  </div>
                )}

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="spare_vehicle"
                      checked={formData.spare_vehicle}
                      onChange={(e) =>
                        setFormData({ ...formData, spare_vehicle: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="spare_vehicle">Spare Vehicle</Label>
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="off_the_road"
                      checked={formData.off_the_road}
                      onChange={(e) =>
                        setFormData({ ...formData, off_the_road: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <Label htmlFor="off_the_road">Off the Road</Label>
                  </div>
                </div>

                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="assigned_to" className="text-xs font-medium text-slate-600">
                    Assigned To (MOT & Service Follow-up)
                  </Label>
                  <SearchableSelect
                    id="assigned_to"
                    value={formData.assigned_to}
                    onChange={(value) => setFormData({ ...formData, assigned_to: value })}
                    options={drivers.map((driver) => ({
                      value: driver.id.toString(),
                      label: driver.name,
                    }))}
                    placeholder="Select driver for MOT & service follow-up..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons for Maintenance */}
        {activeTab === 'maintenance' && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between space-x-4">
                <Button type="button" variant="outline" onClick={handlePrevious} className="text-slate-600 border-slate-300 hover:bg-slate-50">
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                <div className="flex space-x-4">
                  <Link href={`/dashboard/vehicles/${id}`}>
                    <Button type="button" variant="outline" className="text-slate-600 border-slate-300 hover:bg-slate-50">
                      Cancel
                    </Button>
                  </Link>
                  <Button type="button" onClick={handleNext}>
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Seating Plan Tab */}
        {activeTab === 'seating' && (
          <Card>
            <CardHeader className="bg-slate-50 border-b border-slate-200 py-3">
              <CardTitle className="text-slate-900 text-base font-semibold">Seating Plan (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <p className="text-sm text-gray-600">
                Configure the seating layout for this vehicle. You can also add this later from the vehicle detail page.
              </p>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="seating_plan_name">Plan Name</Label>
                  <Input
                    id="seating_plan_name"
                    value={formData.seating_plan_name}
                    onChange={(e) =>
                      setFormData({ ...formData, seating_plan_name: e.target.value })
                    }
                    placeholder="e.g., Standard Coach (45 passengers)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="total_capacity">Total Capacity</Label>
                  <Input
                    id="total_capacity"
                    type="number"
                    min="1"
                    value={formData.total_capacity}
                    onChange={(e) =>
                      setFormData({ ...formData, total_capacity: e.target.value })
                    }
                    placeholder="e.g., 45"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="wheelchair_spaces">Wheelchair Spaces</Label>
                  <Input
                    id="wheelchair_spaces"
                    type="number"
                    min="0"
                    value={formData.wheelchair_spaces}
                    onChange={(e) =>
                      setFormData({ ...formData, wheelchair_spaces: e.target.value })
                    }
                    placeholder="e.g., 2"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rows">Number of Rows</Label>
                  <Input
                    id="rows"
                    type="number"
                    min="1"
                    value={formData.rows}
                    onChange={(e) =>
                      setFormData({ ...formData, rows: e.target.value })
                    }
                    placeholder="e.g., 12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="seats_per_row">Seats per Row</Label>
                  <Input
                    id="seats_per_row"
                    type="number"
                    min="1"
                    value={formData.seats_per_row}
                    onChange={(e) =>
                      setFormData({ ...formData, seats_per_row: e.target.value })
                    }
                    placeholder="e.g., 4"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="seating_notes">Seating Notes</Label>
                  <textarea
                    id="seating_notes"
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={formData.seating_notes}
                    onChange={(e) =>
                      setFormData({ ...formData, seating_notes: e.target.value })
                    }
                    placeholder="e.g., 2 wheelchair lifts, emergency exit row 5"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons for Seating */}
        {activeTab === 'seating' && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between space-x-4">
                <Button type="button" variant="outline" onClick={handlePrevious} className="text-slate-600 border-slate-300 hover:bg-slate-50">
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                <div className="flex space-x-4">
                  <Link href={`/dashboard/vehicles/${id}`}>
                    <Button type="button" variant="outline" className="text-slate-600 border-slate-300 hover:bg-slate-50">
                      Cancel
                    </Button>
                  </Link>
                  <Button type="button" onClick={handleNext}>
                    Next
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <Card>
            <CardHeader className="bg-slate-50 border-b border-slate-200 py-3">
              <CardTitle className="text-slate-900 text-base font-semibold">Additional Notes</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  rows={6}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Any additional information about the vehicle..."
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons for Notes (Final Tab) */}
        {activeTab === 'notes' && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between space-x-4">
                <Button type="button" variant="outline" onClick={handlePrevious} className="text-slate-600 border-slate-300 hover:bg-slate-50">
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Previous
                </Button>
                <div className="flex space-x-4">
                  <Link href={`/dashboard/vehicles/${id}`}>
                    <Button type="button" variant="outline" className="text-slate-600 border-slate-300 hover:bg-slate-50">
                      Cancel
                    </Button>
                  </Link>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  )
}

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <EditVehiclePageClient id={id} />
}

