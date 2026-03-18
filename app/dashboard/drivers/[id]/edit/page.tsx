'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { ArrowLeft, AlertCircle, Upload, CheckCircle } from 'lucide-react'
import { SubjectDocumentsChecklist } from '@/components/dashboard/SubjectDocumentsChecklist'

interface Driver {
  employee_id: number
  employees: {
    id: number
    full_name: string
    role: string
  }
}

export default function EditDriverPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [driver, setDriver] = useState<Driver | null>(null)

  const [formData, setFormData] = useState({
    spare_driver: false,
    self_employed: false,
    tas_badge_number: '',
    tas_badge_expiry_date: '',
    dbs_number: '',
    psv_license: false,
    first_aid_certificate_expiry_date: '',
    passport_expiry_date: '',
    driving_license_expiry_date: '',
    cpc_expiry_date: '',
    utility_bill_date: '',
    birth_certificate: false,
    marriage_certificate: false,
    photo_taken: false,
    private_hire_badge: false,
    paper_licence: false,
    taxi_plate_photo: false,
    logbook: false,
    additional_notes: '',
  })

  // File uploads state
  const [fileUploads, setFileUploads] = useState<{ [key: string]: File | null }>({
    tas_badge_file: null,
    dbs_file: null,
    first_aid_file: null,
    passport_file: null,
    driving_license_file: null,
    cpc_file: null,
    utility_bill_file: null,
    birth_cert_file: null,
    marriage_cert_file: null,
    photo_file: null,
    private_hire_badge_file: null,
    paper_licence_file: null,
    taxi_plate_photo_file: null,
    logbook_file: null,
    badge_photo_file: null,
  })

  useEffect(() => {
    loadDriver()
  }, [params.id])

  const loadDriver = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('drivers')
      .select(`
        *,
        employees (
          id,
          full_name,
          role
        )
      `)
      .eq('employee_id', params.id)
      .single()

    if (error || !data) {
      setError('Driver not found')
      setLoading(false)
      return
    }

    setDriver(data as Driver)
    setFormData({
      spare_driver: (data as any).spare_driver || false,
      self_employed: (data as any).self_employed || false,
      tas_badge_number: data.tas_badge_number || '',
      tas_badge_expiry_date: data.tas_badge_expiry_date ? data.tas_badge_expiry_date.split('T')[0] : '',
      dbs_number: data.dbs_number || '',
      psv_license: data.psv_license || false,
      first_aid_certificate_expiry_date: data.first_aid_certificate_expiry_date ? data.first_aid_certificate_expiry_date.split('T')[0] : '',
      passport_expiry_date: data.passport_expiry_date ? data.passport_expiry_date.split('T')[0] : '',
      driving_license_expiry_date: data.driving_license_expiry_date ? data.driving_license_expiry_date.split('T')[0] : '',
      cpc_expiry_date: data.cpc_expiry_date ? data.cpc_expiry_date.split('T')[0] : '',
      utility_bill_date: data.utility_bill_date ? data.utility_bill_date.split('T')[0] : '',
      birth_certificate: data.birth_certificate || false,
      marriage_certificate: data.marriage_certificate || false,
      photo_taken: data.photo_taken || false,
      private_hire_badge: data.private_hire_badge || false,
      paper_licence: data.paper_licence || false,
      taxi_plate_photo: data.taxi_plate_photo || false,
      logbook: data.logbook || false,
      additional_notes: data.additional_notes || '',
    })
    setLoading(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleFileChange = (fieldName: string, file: File | null) => {
    setFileUploads(prev => ({
      ...prev,
      [fieldName]: file
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      // Upload files to Supabase Storage if needed
      const uploadedDocuments: Array<{
        fileUrl: string
        fileName: string
        fileType: string
        docType: string
        filePath: string
      }> = []

      const fileKeyToDocType: { [key: string]: string } = {
        tas_badge_file: 'TAS Badge',
        dbs_file: 'DBS Certificate',
        first_aid_file: 'First Aid Certificate',
        passport_file: 'Passport',
        driving_license_file: 'Driving License',
        cpc_file: 'CPC Certificate',
        utility_bill_file: 'Utility Bill',
        birth_cert_file: 'Birth Certificate',
        marriage_cert_file: 'Marriage Certificate',
        photo_file: 'Photo',
        private_hire_badge_file: 'Private Hire Badge',
        paper_licence_file: 'Paper Licence',
        taxi_plate_photo_file: 'Taxi Plate Photo',
        logbook_file: 'Logbook',
        badge_photo_file: 'ID Badge Photo',
      }

      for (const [key, file] of Object.entries(fileUploads)) {
        if (file && driver) {
          const fileExt = file.name.split('.').pop()
          const fileName = `drivers/${driver.employee_id}/${key}_${Date.now()}.${fileExt}`

          const { data, error } = await supabase.storage
            .from('DRIVER_DOCUMENTS')
            .upload(fileName, file)

          if (error) {
            console.error(`Error uploading file ${file.name}:`, error)
            if (error.message.includes('Bucket not found') || error.message.includes('not found')) {
              setError('Storage bucket "DRIVER_DOCUMENTS" not found. Please create a public bucket named "DRIVER_DOCUMENTS" in your Supabase Storage settings.')
            } else {
              setError(`Failed to upload ${file.name}: ${error.message}`)
            }
            continue // Skip this file but continue saving others
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

      const { error: updateError } = await supabase
        .from('drivers')
        .update({
          spare_driver: formData.spare_driver,
          self_employed: formData.self_employed,
          tas_badge_number: formData.tas_badge_number || null,
          tas_badge_expiry_date: formData.tas_badge_expiry_date || null,
          // Removed Taxi Badge as per previous file logic (tracked on vehicle)
          dbs_number: formData.dbs_number || null,
          psv_license: formData.psv_license,
          first_aid_certificate_expiry_date: formData.first_aid_certificate_expiry_date || null,
          passport_expiry_date: formData.passport_expiry_date || null,
          driving_license_expiry_date: formData.driving_license_expiry_date || null,
          cpc_expiry_date: formData.cpc_expiry_date || null,
          utility_bill_date: formData.utility_bill_date || null,
          birth_certificate: formData.birth_certificate,
          marriage_certificate: formData.marriage_certificate,
          photo_taken: formData.photo_taken,
          private_hire_badge: formData.private_hire_badge,
          paper_licence: formData.paper_licence,
          taxi_plate_photo: formData.taxi_plate_photo,
          logbook: formData.logbook,
          additional_notes: formData.additional_notes || null,
        })
        .eq('employee_id', params.id)

      if (updateError) throw updateError

      // Audit log
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'drivers',
          record_id: parseInt(params.id),
          action: 'UPDATE',
        }),
      }).catch(err => console.error('Audit log error:', err))

      // Create document records and link to driver
      if (uploadedDocuments.length > 0 && driver) {
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
          console.error('Error saving document records:', documentsError)
          setError(`Driver saved but document records failed: ${documentsError.message}`)
        } else if (insertedDocs?.length) {
          const links = insertedDocs.map((doc: any) => ({
            document_id: doc.id,
            driver_employee_id: driver.employee_id,
          }))
          await supabase.from('document_driver_links').insert(links)
        }
      }

      router.push(`/dashboard/drivers/${params.id}`)
    } catch (err: any) {
      console.error('Error updating driver:', err)
      setError(err.message || 'Failed to update driver')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSaving(false)
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

  // Component for certificate card
  const CertificateCard = ({ title, dateId, dateVal, fileId, fileVal }: any) => (
    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-700">{title}</span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <CompactDateInput
          id={dateId}
          label="Expiry Date"
          value={dateVal}
          onChange={handleInputChange}
        />
        <div>
          <Label htmlFor={fileId} className="text-xs text-slate-500">Update Certificate</Label>
          <CompactFileUpload id={fileId} onChange={handleFileChange} file={fileVal} />
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="max-w-[1600px] mx-auto p-4 space-y-6 animate-pulse">
        <div className="h-16 bg-slate-200 rounded-md w-full mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3 h-96 bg-slate-200 rounded-lg" />
          <div className="lg:col-span-5 h-96 bg-slate-200 rounded-lg" />
          <div className="lg:col-span-4 h-96 bg-slate-200 rounded-lg" />
        </div>
      </div>
    )
  }

  if (!driver) return <div className="p-8 text-center">Driver not found</div>

  return (
    <div className="max-w-[1600px] mx-auto p-4 space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 -mx-6 -mt-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/drivers/${params.id}`}>
            <Button variant="outline" size="sm" className="h-9 px-3 gap-2 text-slate-600 border-slate-300 hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Edit Driver: {driver.employees.full_name}</h1>
            <p className="text-xs text-slate-500">Compact Mode</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/drivers/${params.id}`}>
            <Button variant="outline" size="sm" className="text-slate-600 border-slate-300 hover:bg-slate-50">Cancel</Button>
          </Link>
          <Button onClick={handleSubmit} disabled={saving} className="min-w-[100px]">
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-3 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p className="font-medium">{error}</p>
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
                      <div className="relative w-full h-full bg-slate-800 flex items-center justify-center">
                        <p className="text-xs text-white">New Photo Selected</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 mb-2" />
                        <span className="text-xs font-medium">Update Badge Photo</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <Label className="text-xs text-blue-800 uppercase font-bold">Employee</Label>
                  <p className="text-sm font-semibold text-blue-900">{driver.employees.full_name}</p>
                  <p className="text-xs text-blue-600">{driver.employees.role}</p>
                  <Link href={`/dashboard/employees/${driver.employees.id}/edit`} className="text-[10px] underline text-blue-500 hover:text-blue-700 mt-1 block">
                    Edit Employee Details
                  </Link>
                </div>

                <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <input
                    type="checkbox"
                    id="spare_driver"
                    name="spare_driver"
                    checked={formData.spare_driver}
                    onChange={(e) => setFormData({ ...formData, spare_driver: e.target.checked })}
                    className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
                  <div className="flex-1">
                    <Label htmlFor="spare_driver" className="text-sm font-semibold text-amber-900 cursor-pointer">Mark as Spare Driver</Label>
                    <p className="text-[10px] text-amber-700 leading-tight mt-0.5">Not assigned to specific route, available for cover.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <input
                    type="checkbox"
                    id="self_employed"
                    name="self_employed"
                    checked={formData.self_employed}
                    onChange={(e) => setFormData({ ...formData, self_employed: e.target.checked })}
                    className="rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <div className="flex-1">
                    <Label htmlFor="self_employed" className="text-sm font-semibold text-slate-900 cursor-pointer">Self Employed</Label>
                    <p className="text-[10px] text-slate-600 leading-tight mt-0.5">Driver is self-employed (yes/no).</p>
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
                  { id: 'psv_license', label: 'PSV License' },
                  { id: 'self_employed', label: 'Self Employed' },
                  { id: 'private_hire_badge', label: 'Private Hire Badge' },
                  { id: 'dbs_check', label: 'DBS Checked', warning: 'Requires valid number' }, // Logic check not exact prop but visual
                  // Since dbs_check isn't a prop in formData, map logic if needed or skip.
                  // Let's use actual props:
                ].filter(x => x.id !== 'dbs_check').map((item) => (
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
                {/* Manual check for DBS visual consistency if wanted, otherwise rely on Number input */}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                  <div className="mb-2">
                    <Label htmlFor="tas_badge_number" className="text-xs font-semibold text-blue-900">TAS Badge Number</Label>
                    <Input
                      id="tas_badge_number"
                      name="tas_badge_number"
                      value={formData.tas_badge_number}
                      onChange={handleInputChange}
                      placeholder="e.g. TAS12345"
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <CertificateCard
                    title="TAS Badge Expiry"
                    dateId="tas_badge_expiry_date"
                    dateVal={formData.tas_badge_expiry_date}
                    fileId="tas_badge_file"
                    fileVal={fileUploads.tas_badge_file}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="dbs_number" className="text-xs text-slate-500">DBS Number</Label>
                  <Input
                    id="dbs_number"
                    name="dbs_number"
                    value={formData.dbs_number}
                    onChange={handleInputChange}
                    placeholder="e.g. 001234567890"
                    className="h-8 text-sm mb-2"
                  />
                  <CertificateCard
                    title="DBS Certificate"
                    dateId="dbs_date_placeholder" // No date prop for DBS
                    dateVal=""
                    fileId="dbs_file"
                    fileVal={fileUploads.dbs_file}
                  />
                </div>

                <CertificateCard
                  title="Driving License"
                  dateId="driving_license_expiry_date"
                  dateVal={formData.driving_license_expiry_date}
                  fileId="driving_license_file"
                  fileVal={fileUploads.driving_license_file}
                />

                <CertificateCard
                  title="CPC Certificate"
                  dateId="cpc_expiry_date"
                  dateVal={formData.cpc_expiry_date}
                  fileId="cpc_file"
                  fileVal={fileUploads.cpc_file}
                />

                <CertificateCard
                  title="First Aid"
                  dateId="first_aid_certificate_expiry_date"
                  dateVal={formData.first_aid_certificate_expiry_date}
                  fileId="first_aid_file"
                  fileVal={fileUploads.first_aid_file}
                />

                <CertificateCard
                  title="Passport"
                  dateId="passport_expiry_date"
                  dateVal={formData.passport_expiry_date}
                  fileId="passport_file"
                  fileVal={fileUploads.passport_file}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Column 3: Docs (Right) */}
        <div className="lg:col-span-4 flex flex-col gap-4 h-full">
          <Card className="flex-1">
            <CardContent className="p-4 space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 border-b pb-2">Additional Docs</h2>

              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Utility Bill</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="date" name="utility_bill_date" value={formData.utility_bill_date} onChange={handleInputChange} max="9999-12-31" className="h-7 text-xs" />
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
                      const currentFile = fileUploads[fileKey as keyof typeof fileUploads]

                      return (
                        <div key={label} className="flex flex-col gap-1">
                          <span className="text-slate-500 truncate">{label}</span>
                          <CompactFileUpload id={fileKey} onChange={handleFileChange} file={currentFile} />
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

      {/* Required documents checklist (same rules as create, with existing data visible) */}
      <div className="mt-6">
        <SubjectDocumentsChecklist subjectType="driver" subjectId={driver.employee_id} />
      </div>
    </div>
  )
}
