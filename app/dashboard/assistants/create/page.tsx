'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'
import { ArrowLeft, Upload, Save, AlertCircle, FileText, CheckCircle, GraduationCap } from 'lucide-react'
import Link from 'next/link'
import { DynamicCertificatesForm } from '@/components/dashboard/DynamicCertificatesForm'

interface Employee {
  id: number
  full_name: string
  role: string
  employment_status: string
}

export default function CreatePassengerAssistantPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({})
  const [employees, setEmployees] = useState<Employee[]>([])
  const minYear = 1900
  const maxYear = new Date().getFullYear() + 20
  const minDate = `${minYear}-01-01`
  const maxDate = `${maxYear}-12-31`

  const [formData, setFormData] = useState({
    employee_id: '',
    spare_pa: false,
    tas_badge_number: '',
    tas_badge_expiry_date: '',
    dbs_number: '',
    first_aid_certificate_expiry_date: '',
    passport_expiry_date: '',
    utility_bill_date: '',
    birth_certificate: false,
    marriage_certificate: false,
    photo_taken: false,
    paper_licence: false,
    taxi_plate_photo: false, // Often N/A for PA but keeping schema consistency
    safeguarding_training_completed: false,
    safeguarding_training_date: '',
    tas_pats_training_completed: false,
    tas_pats_training_date: '',
    psa_training_completed: false, // Often N/A for PA but keeping schema consistency
    psa_training_date: '',
    additional_notes: '',
  })

  // File uploads state
  const [fileUploads, setFileUploads] = useState<{ [key: string]: File | null }>({
    tas_badge_file: null,
    dbs_file: null,
    first_aid_file: null,
    passport_file: null,
    utility_bill_file: null,
    birth_cert_file: null,
    marriage_cert_file: null,
    photo_file: null,
    paper_licence_file: null,
    taxi_plate_photo_file: null,
    badge_photo_file: null,
  })

  // Dynamic certificates state
  const [certificatesFormData, setCertificatesFormData] = useState<Record<string, {
    certificate_number: string
    expiry_date: string
    issue_date: string
    file: File | null
  }>>({})
  const [certificatesFileUploads, setCertificatesFileUploads] = useState<Record<string, File | null>>({})

  useEffect(() => {
    async function loadEmployees() {
      // Fetch employees who are not already passenger assistants or drivers
      const [existingPAs, existingDrivers] = await Promise.all([
        supabase.from('passenger_assistants').select('employee_id'),
        supabase.from('drivers').select('employee_id'),
      ])

      const paIds = existingPAs.data?.map(pa => pa.employee_id) || []
      const driverIds = existingDrivers.data?.map(d => d.employee_id) || []
      const excludedIds = Array.from(new Set([...paIds, ...driverIds]))

      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name, role, employment_status')
        .eq('employment_status', 'Active')
        .order('full_name')

      if (!error && data) {
        // Filter out employees who are already PAs or drivers
        const availableEmployees = data.filter(emp => !excludedIds.includes(emp.id))
        setEmployees(availableEmployees)
      }
    }
    loadEmployees()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
    if (error) setError(null)
  }

  const handleFileChange = (fieldName: string, file: File | null) => {
    setFileUploads(prev => ({
      ...prev,
      [fieldName]: file
    }))
  }

  const handleCertificateFormDataChange = useCallback((requirementId: string, field: string, value: string | File | null) => {
    setCertificatesFormData(prev => ({
      ...prev,
      [requirementId]: {
        ...(prev[requirementId] || { certificate_number: '', expiry_date: '', issue_date: '', file: null }),
        [field]: value,
      }
    }))
  }, [])

  const handleCertificateFileChange = (requirementId: string, file: File | null) => {
    setCertificatesFileUploads(prev => ({
      ...prev,
      [requirementId]: file
    }))
    handleCertificateFormDataChange(requirementId, 'file', file)
  }

  const validateForm = (): { isValid: boolean; errors: { [key: string]: string } } => {
    const errors: { [key: string]: string } = {}

    if (!formData.employee_id || formData.employee_id.trim() === '') {
      errors.employee_id = 'Please select an employee'
    }

    // Dynamic certificate validation will be handled separately
    const dateFields: Array<{ key: keyof typeof formData; label: string }> = [
      // Dynamic certificate date validation handled separately
      { key: 'utility_bill_date', label: 'Utility Bill date' },
      { key: 'safeguarding_training_date', label: 'Safeguarding training date' },
      { key: 'tas_pats_training_date', label: 'TAS PATS training date' },
      { key: 'psa_training_date', label: 'PSA training date' },
    ]
    dateFields.forEach(({ key, label }) => {
      const value = formData[key]
      if (value && (value < minDate || value > maxDate)) {
        errors[key] = `${label} must be between ${minYear} and ${maxYear}`
      }
    })

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validation = validateForm()

    if (!validation.isValid) {
      setFieldErrors(validation.errors)
      setError('Please fill in all required fields before submitting')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Upload files to Supabase Storage if needed
      // Using DRIVER_DOCUMENTS bucket (same as drivers)
      const uploadedDocuments: Array<{
        fileUrl: string
        fileName: string
        fileType: string
        docType: string
        filePath: string
      }> = []

      // Map file keys to document types
      const fileKeyToDocType: { [key: string]: string } = {
        tas_badge_file: 'TAS Badge',
        dbs_file: 'DBS Certificate',
        first_aid_file: 'First Aid Certificate',
        passport_file: 'Passport',
        utility_bill_file: 'Utility Bill',
        birth_cert_file: 'Birth Certificate',
        marriage_cert_file: 'Marriage Certificate',
        photo_file: 'Photo',
        paper_licence_file: 'Paper Licence',
        taxi_plate_photo_file: 'Taxi Plate Photo',
        badge_photo_file: 'ID Badge Photo',
      }

      for (const [key, file] of Object.entries(fileUploads)) {
        if (file) {
          const fileExt = file.name.split('.').pop()
          const fileName = `assistants/${formData.employee_id}/${key}_${Date.now()}.${fileExt}`

          const { data, error } = await supabase.storage
            .from('DRIVER_DOCUMENTS')
            .upload(fileName, file)

          if (error) {
            console.error(`Error uploading file ${file.name}:`, error)
            // Provide helpful error message for bucket not found
            if (error.message.includes('Bucket not found') || error.message.includes('not found')) {
              throw new Error('Storage bucket "DRIVER_DOCUMENTS" not found.')
            }
            throw error
          }

          if (data) {
            const { data: { publicUrl } } = supabase.storage
              .from('DRIVER_DOCUMENTS')
              .getPublicUrl(fileName)

            uploadedDocuments.push({
              fileUrl: publicUrl,
              fileName: file.name,
              fileType: file.type || 'application/octet-stream',
              docType: fileKeyToDocType[key] || 'Certificate',
              filePath: fileName,
            })
          }
        }
      }

      // Insert passenger assistant record
      const paData = {
        employee_id: parseInt(formData.employee_id),
        tas_badge_number: formData.tas_badge_number || null,
        tas_badge_expiry_date: formData.tas_badge_expiry_date || null,
        dbs_number: formData.dbs_number || null,
        first_aid_certificate_expiry_date: formData.first_aid_certificate_expiry_date || null,
        passport_expiry_date: formData.passport_expiry_date || null,
        utility_bill_date: formData.utility_bill_date || null,
        birth_certificate: formData.birth_certificate,
        marriage_certificate: formData.marriage_certificate,
        photo_taken: formData.photo_taken,
        paper_licence: formData.paper_licence,
        taxi_plate_photo: formData.taxi_plate_photo,
        safeguarding_training_completed: formData.safeguarding_training_completed,
        safeguarding_training_date: formData.safeguarding_training_date || null,
        tas_pats_training_completed: formData.tas_pats_training_completed,
        tas_pats_training_date: formData.tas_pats_training_date || null,
        psa_training_completed: formData.psa_training_completed,
        psa_training_date: formData.psa_training_date || null,
        additional_notes: formData.additional_notes || null,
        spare_pa: formData.spare_pa,
      }

      // Verify employee exists before insert
      const { data: employeeCheck, error: employeeError } = await supabase
        .from('employees')
        .select('id')
        .eq('id', parseInt(formData.employee_id))
        .single()

      if (employeeError || !employeeCheck) {
        throw new Error(`Employee with ID ${formData.employee_id} does not exist`)
      }

      // Check if employee is already a PA
      const { data: existingPA, error: paCheckError } = await supabase
        .from('passenger_assistants')
        .select('employee_id')
        .eq('employee_id', parseInt(formData.employee_id))
        .maybeSingle()

      if (existingPA) {
        throw new Error('This employee is already registered as a passenger assistant')
      }

      const { data: paResult, error: insertError } = await supabase
        .from('passenger_assistants')
        .insert([paData])
        .select()

      if (insertError) throw insertError

      // Audit log
      if (paResult && paResult[0]) {
        await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table_name: 'passenger_assistants',
            record_id: paResult[0].id,
            action: 'CREATE',
          }),
        }).catch(err => console.error('Audit log error:', err))
      }

      // Create document records and link to PA
      if (uploadedDocuments.length > 0) {
        const documentRecords = uploadedDocuments.map(doc => ({
          file_url: JSON.stringify([doc.fileUrl]),
          file_name: doc.fileName,
          file_type: doc.fileType,
          file_path: doc.fileUrl,
          doc_type: doc.docType,
          uploaded_at: new Date().toISOString(),
        }))

        const { data: insertedDocs, error: documentsError } = await supabase
          .from('documents')
          .insert(documentRecords)
          .select('id')

        if (documentsError) {
          console.error('Error creating document records:', documentsError)
        } else if (insertedDocs?.length) {
          const links = insertedDocs.map((doc: any) => ({
            document_id: doc.id,
            pa_employee_id: parseInt(formData.employee_id),
          }))
          await supabase.from('document_pa_links').insert(links)
        }
      }

      // Handle dynamic certificates
      // The trigger will auto-create subject_documents, so we need to update them
      if (Object.keys(certificatesFormData).length > 0 || Object.keys(certificatesFileUploads).length > 0) {
        // Fetch auto-created subject_documents
        const { data: autoCreatedDocs, error: fetchError } = await supabase
          .from('subject_documents')
          .select('id, requirement_id')
          .eq('subject_type', 'pa')
          .eq('pa_employee_id', parseInt(formData.employee_id))

        if (!fetchError && autoCreatedDocs) {
          // Update subject_documents with form data
          for (const [requirementId, certData] of Object.entries(certificatesFormData)) {
            const existingDoc = autoCreatedDocs.find(doc => doc.requirement_id === requirementId)
            if (existingDoc) {
              const updateData: any = {}
              if (certData.certificate_number) updateData.certificate_number = certData.certificate_number
              if (certData.expiry_date) updateData.expiry_date = certData.expiry_date
              if (certData.issue_date) updateData.issue_date = certData.issue_date
              if (certData.expiry_date || certData.certificate_number) {
                updateData.status = 'valid'
              }

              await supabase
                .from('subject_documents')
                .update(updateData)
                .eq('id', existingDoc.id)
            }
          }

          // Upload certificate files
          for (const [requirementId, file] of Object.entries(certificatesFileUploads)) {
            if (file) {
              const fileExt = file.name.split('.').pop()
              const fileName = `assistants/${formData.employee_id}/certificates/${requirementId}_${Date.now()}.${fileExt}`

              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('DRIVER_DOCUMENTS')
                .upload(fileName, file)

              if (!uploadError && uploadData) {
                const { data: { publicUrl } } = supabase.storage
                  .from('DRIVER_DOCUMENTS')
                  .getPublicUrl(fileName)

                // Create document record
                const { data: docRecord, error: docError } = await supabase
                  .from('documents')
                  .insert({
                    file_name: file.name,
                    file_type: file.type || 'application/octet-stream',
                    file_path: fileName,
                    file_url: publicUrl,
                    doc_type: 'Certificate',
                    uploaded_by: null,
                  })
                  .select('id')
                  .single()

                if (!docError && docRecord) {
                  // Link document to PA and subject_document
                  const existingDoc = autoCreatedDocs.find(doc => doc.requirement_id === requirementId)
                  if (existingDoc) {
                    await supabase.from('document_pa_links').insert({
                      document_id: docRecord.id,
                      pa_employee_id: parseInt(formData.employee_id),
                    })
                    await supabase.from('document_subject_document_links').insert({
                      document_id: docRecord.id,
                      subject_document_id: existingDoc.id,
                    })
                  }
                }
              }
            }
          }
        }
      }

      router.push('/dashboard/assistants')
    } catch (err: any) {
      console.error('Error creating passenger assistant:', err)
      setError(err.message || 'Failed to create passenger assistant')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setLoading(false)
    }
  }

  // Component for compact date input
  const CompactDateInput = ({ id, label, value, onChange, required = false, error }: any) => (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-slate-500">{label} {required && <span className="text-red-500">*</span>}</Label>
      <Input
        type="date"
        id={id}
        name={id}
        value={value}
        onChange={onChange}
        required={required}
        min={minDate}
        max="9999-12-31"
        className={`h-8 text-sm ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
      />
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  )

  // Component for compact file upload
  const CompactFileUpload = ({ id, onChange, file }: any) => (
    <div className="flex items-center gap-2 mt-1 w-full">
      <label
        htmlFor={id}
        className="cursor-pointer bg-[#023E8A] text-white px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider hover:bg-[#023E8A]/90 transition-colors shrink-0 shadow-sm flex items-center gap-1"
      >
        <span className="hidden sm:inline">Upload</span>
        <span className="sm:hidden">...</span>
      </label>
      <div
        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[10px] text-slate-500 truncate cursor-default select-none flex items-center gap-2 shadow-sm"
        title={file?.name || 'No file selected'}
      >
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${file ? 'bg-green-500' : 'bg-slate-300'}`} />
        <span className={`truncate ${file ? 'text-slate-700 font-medium' : 'text-slate-400 italic'}`}>
          {file?.name || 'No file selected'}
        </span>
      </div>
      <input
        type="file"
        id={id}
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={(e) => onChange(id, e.target.files?.[0] || null)}
        className="hidden"
      />
    </div>
  )


  return (
    <div className="max-w-[1600px] mx-auto p-4 space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 -mx-6 -mt-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/assistants">
            <Button variant="outline" size="sm" className="h-9 px-3 gap-2 text-slate-600 border-slate-300 hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Add Passenger Assistant</h1>
            <p className="text-xs text-slate-500">Compact Mode</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/assistants">
            <Button variant="outline" size="sm" className="text-slate-600 border-slate-300 hover:bg-slate-50">Cancel</Button>
          </Link>
          <Button onClick={handleSubmit} disabled={loading} className="min-w-[100px]">
            {loading ? 'Saving...' : 'Save PA'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-3 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">{error}</p>
            {Object.values(fieldErrors).length > 0 && (
              <ul className="mt-1 list-disc list-inside text-xs">
                {Object.values(fieldErrors).map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

        {/* Column 1: Identity & Status (Left) */}
        <div className="lg:col-span-3 flex flex-col gap-4 h-full">
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 border-b pb-2">Identity</h2>

              <div className="space-y-4">
                <div className="relative group">
                  <div className="w-full aspect-square bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 hover:border-primary/50 transition-colors cursor-pointer overflow-hidden">
                    <input
                      type="file"
                      id="badge_photo_file"
                      accept="image/*"
                      onChange={(e) => handleFileChange('badge_photo_file', e.target.files?.[0] || null)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    {fileUploads.badge_photo_file ? (
                      <div className="relative w-full h-full">
                        <p className="absolute bottom-2 left-0 right-0 text-center text-xs bg-black/50 text-white py-1">Photo Selected</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 mb-2" />
                        <span className="text-xs font-medium">Upload Badge Photo</span>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="employee_id" className="text-sm font-semibold">Select Employee <span className="text-red-500">*</span></Label>
                  <Select
                    id="employee_id"
                    name="employee_id"
                    value={formData.employee_id}
                    onChange={handleInputChange}
                    required
                    error={!!fieldErrors.employee_id}
                    className="mt-1"
                  >
                    <option value="">-- Select --</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                    ))}
                  </Select>
                  {fieldErrors.employee_id && <span className="text-xs text-red-500">{fieldErrors.employee_id}</span>}
                </div>

                <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <input
                    type="checkbox"
                    id="spare_pa"
                    name="spare_pa"
                    checked={formData.spare_pa}
                    onChange={(e) => setFormData({ ...formData, spare_pa: e.target.checked })}
                    className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
                  <div className="flex-1">
                    <Label htmlFor="spare_pa" className="text-sm font-semibold text-amber-900 cursor-pointer">Mark as Spare PA</Label>
                    <p className="text-[10px] text-amber-700 leading-tight mt-0.5">Not assigned to specific route, available for cover.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardContent className="p-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 border-b pb-2">Checklist</h2>
              <div className="space-y-2">
                {[
                  { id: 'dbs_check', label: 'DBS Checked', warning: 'Requires valid number' },
                  { id: 'birth_certificate', label: 'Birth Certificate' },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded transition-colors">
                    <Label htmlFor={item.id} className="text-sm text-slate-700 cursor-pointer flex-1">{item.label}</Label>
                    <input
                      type="checkbox"
                      id={item.id}
                      name={item.id}
                      checked={formData[item.id as keyof typeof formData] as boolean}
                      onChange={handleInputChange}
                      className="rounded border-slate-300 text-primary focus:ring-primary"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Column 2: Core Certificates (Center) */}
        <div className="lg:col-span-5 flex flex-col gap-4 h-full">
          <Card className="h-full">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Critical Certificates</h2>
                <div className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                  <AlertCircle className="h-3 w-3" />
                  <span>Expiry tracking enabled</span>
                </div>
              </div>

              <DynamicCertificatesForm
                subjectType="pa"
                formData={certificatesFormData}
                fileUploads={certificatesFileUploads}
                fieldErrors={fieldErrors}
                onFormDataChange={handleCertificateFormDataChange}
                onFileChange={handleCertificateFileChange}
                minDate={minDate}
                maxDate={maxDate}
              />
            </CardContent>
          </Card>
        </div>

        {/* Column 3: Docs & Training (Right) */}
        <div className="lg:col-span-4 flex flex-col gap-4 h-full">
          <Card>
            <CardContent className="p-4 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 border-b pb-2">Training Status</h2>

              <div className="space-y-3">
                {[
                  {
                    id: 'safeguarding_training',
                    label: 'Safeguarding',
                    completed: formData.safeguarding_training_completed,
                    date: formData.safeguarding_training_date
                  },
                  {
                    id: 'tas_pats_training',
                    label: 'TAS PATS',
                    completed: formData.tas_pats_training_completed,
                    date: formData.tas_pats_training_date
                  },
                ].map((t) => (
                  <div key={t.id} className={`p-3 rounded-lg border text-sm ${t.completed ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`font-semibold ${t.completed ? 'text-green-800' : 'text-slate-600'}`}>{t.label}</span>
                      <input
                        type="checkbox"
                        name={`${t.id}_completed`}
                        checked={t.completed}
                        onChange={handleInputChange}
                        className="rounded border-slate-300 text-green-600 focus:ring-green-500"
                      />
                    </div>
                    {t.completed && (
                      <input
                        type="date"
                        name={`${t.id}_date`}
                        value={t.date}
                        onChange={handleInputChange}
                        min={minDate}
                        max="9999-12-31"
                        className="w-full h-7 text-xs border-slate-200 rounded bg-white px-2"
                      />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardContent className="p-4 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 border-b pb-2">Additional Docs</h2>

              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Utility Bill</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      name="utility_bill_date"
                      value={formData.utility_bill_date}
                      onChange={handleInputChange}
                      min={minDate}
                      max="9999-12-31"
                      className="h-7 text-xs"
                    />
                    <CompactFileUpload id="utility_bill_file" onChange={handleFileChange} file={fileUploads.utility_bill_file} />
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-sm font-semibold">Additional Files</Label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {['Paper Licence', 'Birth Certificate', 'Marriage Certificate'].map((label, i) => {
                      const fileKey = {
                        'Paper Licence': 'paper_licence_file',
                        'Birth Certificate': 'birth_cert_file',
                        'Marriage Certificate': 'marriage_cert_file'
                      }[label] || 'unknown'

                      // Need to get state from fileUploads dynamically
                      const mapping = {
                        'Paper Licence': { key: 'paper_licence_file', state: fileUploads.paper_licence_file },
                        'Birth Certificate': { key: 'birth_cert_file', state: fileUploads.birth_cert_file },
                        'Marriage Certificate': { key: 'marriage_cert_file', state: fileUploads.marriage_cert_file }
                      }
                      const { key, state } = mapping[label as keyof typeof mapping] || { key: fileKey, state: undefined }

                      return (
                        <div key={label} className="flex flex-col gap-1">
                          <span className="text-slate-500 truncate">{label}</span>
                          <CompactFileUpload id={key} onChange={handleFileChange} file={state} />
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="pt-2">
                  <Label htmlFor="additional_notes" className="text-sm font-semibold">Notes</Label>
                  <textarea
                    id="additional_notes"
                    name="additional_notes"
                    value={formData.additional_notes}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full mt-1 rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary h-full min-h-[80px]"
                    placeholder="Private HR notes..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      </form>
    </div>
  )
}
