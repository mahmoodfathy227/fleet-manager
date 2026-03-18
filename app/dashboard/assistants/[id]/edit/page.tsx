'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { ArrowLeft, AlertCircle, Upload, CheckCircle, Clock } from 'lucide-react'
import DeletePAButton from '../DeletePAButton'
import { SubjectDocumentsChecklist } from '@/components/dashboard/SubjectDocumentsChecklist'

interface PassengerAssistant {
  id: number
  employee_id: number
  tas_badge_number: string | null
  tas_badge_expiry_date: string | null
  dbs_number: string | null
  first_aid_certificate_expiry_date: string | null
  passport_expiry_date: string | null
  utility_bill_date: string | null
  birth_certificate: boolean
  marriage_certificate: boolean
  photo_taken: boolean
  paper_licence: boolean
  taxi_plate_photo: boolean
  safeguarding_training_completed: boolean
  safeguarding_training_date: string | null
  tas_pats_training_completed: boolean
  tas_pats_training_date: string | null
  psa_training_completed: boolean
  psa_training_date: string | null
  additional_notes: string | null
  spare_pa?: boolean
  employees: {
    id: number
    full_name: string
  }
}

export default function EditPassengerAssistantPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assistant, setAssistant] = useState<PassengerAssistant | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({})

  const [formData, setFormData] = useState({
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
    taxi_plate_photo: false,
    safeguarding_training_completed: false,
    safeguarding_training_date: '',
    tas_pats_training_completed: false,
    tas_pats_training_date: '',
    psa_training_completed: false,
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

  useEffect(() => {
    loadAssistant()
  }, [params.id])

  const loadAssistant = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('passenger_assistants')
      .select(`
        *,
        employees (
          id,
          full_name
        )
      `)
      .eq('id', params.id)
      .single()

    if (error || !data) {
      setError('Passenger assistant not found')
      setLoading(false)
      return
    }

    setAssistant(data as PassengerAssistant)
    setFormData({
      spare_pa: (data as any).spare_pa || false,
      tas_badge_number: data.tas_badge_number || '',
      tas_badge_expiry_date: data.tas_badge_expiry_date ? data.tas_badge_expiry_date.split('T')[0] : '',
      dbs_number: data.dbs_number || '',
      first_aid_certificate_expiry_date: data.first_aid_certificate_expiry_date ? data.first_aid_certificate_expiry_date.split('T')[0] : '',
      passport_expiry_date: data.passport_expiry_date ? data.passport_expiry_date.split('T')[0] : '',
      utility_bill_date: data.utility_bill_date ? data.utility_bill_date.split('T')[0] : '',
      birth_certificate: data.birth_certificate || false,
      marriage_certificate: data.marriage_certificate || false,
      photo_taken: data.photo_taken || false,
      paper_licence: data.paper_licence || false,
      taxi_plate_photo: data.taxi_plate_photo || false,
      safeguarding_training_completed: data.safeguarding_training_completed || false,
      safeguarding_training_date: data.safeguarding_training_date ? data.safeguarding_training_date.split('T')[0] : '',
      tas_pats_training_completed: data.tas_pats_training_completed || false,
      tas_pats_training_date: data.tas_pats_training_date ? data.tas_pats_training_date.split('T')[0] : '',
      psa_training_completed: data.psa_training_completed || false,
      psa_training_date: data.psa_training_date ? data.psa_training_date.split('T')[0] : '',
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
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      })
    }
  }

  const handleFileChange = (fieldName: string, file: File | null) => {
    setFileUploads(prev => ({
      ...prev,
      [fieldName]: file
    }))
  }

  const validateForm = (): { isValid: boolean; errors: { [key: string]: string } } => {
    const errors: { [key: string]: string } = {};
    // TAS Badge and other certs are in Critical Certificates (dynamic requirements); no legacy field required.
    return { isValid: Object.keys(errors).length === 0, errors };
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validation = validateForm();
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      setError("Please correct the errors before saving.");
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSaving(true)
    setError(null)

    try {
      // Upload files logic... similar to create but ensuring we have employee_id
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
        utility_bill_file: 'Utility Bill',
        birth_cert_file: 'Birth Certificate',
        marriage_cert_file: 'Marriage Certificate',
        photo_file: 'Photo',
        paper_licence_file: 'Paper Licence',
        taxi_plate_photo_file: 'Taxi Plate Photo',
        badge_photo_file: 'ID Badge Photo',
      }

      for (const [key, file] of Object.entries(fileUploads)) {
        if (file && assistant) {
          const fileExt = file.name.split('.').pop()
          const fileName = `assistants/${assistant.employee_id}/${key}_${Date.now()}.${fileExt}`

          const { data, error } = await supabase.storage
            .from('DRIVER_DOCUMENTS')
            .upload(fileName, file)

          if (error) {
            console.error(`Upload error for ${file.name}:`, error);
            continue; // Skip failed upload but continue saving data
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
        .from('passenger_assistants')
        .update({
          spare_pa: formData.spare_pa,
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
        })
        .eq('id', params.id)

      if (updateError) throw updateError

      // Audit log
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'passenger_assistants',
          record_id: parseInt(params.id),
          action: 'UPDATE',
        }),
      }).catch(err => console.error('Audit log error:', err))

      // Insert docs and link to PA
      if (uploadedDocuments.length > 0 && assistant) {
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
        if (documentsError) throw documentsError
        if (insertedDocs?.length) {
          const links = insertedDocs.map((doc: any) => ({
            document_id: doc.id,
            pa_employee_id: assistant.employee_id,
          }))
          await supabase.from('document_pa_links').insert(links)
        }
      }

      router.push(`/dashboard/assistants/${params.id}`)
    } catch (err: any) {
      console.error('Error updating passenger assistant:', err)
      setError(err.message || 'Failed to update passenger assistant')
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
  const CertificateCard = ({ title, dateId, dateVal, fileId, fileVal, required = false, error }: any) => (
    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        {required && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">REQUIRED</span>}
      </div>
      <div className="grid grid-cols-1 gap-2">
        <CompactDateInput
          id={dateId}
          label="Expiry Date"
          value={dateVal}
          onChange={handleInputChange}
          required={required}
          error={error}
        />
        <div>
          <Label htmlFor={fileId} className="text-xs text-slate-500">Update Certificate</Label>
          <CompactFileUpload id={fileId} onChange={handleFileChange} file={fileVal} />
        </div>
      </div>
    </div>
  )

  if (loading) return <div className="p-8 text-center animate-pulse">Loading assistant data...</div>
  if (!assistant) return <div className="p-8 text-center text-red-500">Assistant not found</div>

  return (
    <div className="max-w-[1600px] mx-auto p-4 space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 -mx-6 -mt-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/assistants/${params.id}`}>
            <Button variant="outline" size="sm" className="h-9 px-3 gap-2 text-slate-600 border-slate-300 hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Edit Assistant</h1>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <span className="font-semibold">{assistant.employees?.full_name}</span> (ID: {assistant.employees?.id})
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {assistant && (
            <DeletePAButton 
              paId={assistant.id} 
              employeeId={assistant.employee_id} 
              paName={assistant.employees?.full_name || 'Unknown'} 
            />
          )}
          <Link href={`/dashboard/assistants/${params.id}`}>
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
          <div className="flex-1">
            <p className="font-medium">{error}</p>
            {Object.values(fieldErrors).length > 0 && <ul className="mt-1 list-disc list-inside text-xs">{Object.values(fieldErrors).map((e, i) => <li key={i}>{e}</li>)}</ul>}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

        {/* Column 1: Identity (Left) */}
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
                      <div className="relative w-full h-full flex items-center justify-center bg-slate-200">
                        <p className="text-xs text-slate-600">New Photo Selected</p>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 mb-2" />
                        <span className="text-xs font-medium">Update Badge Photo</span>
                      </>
                    )}
                  </div>
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

        {/* Column 2: Certificates (Center) */}
        <div className="lg:col-span-5 flex flex-col gap-4 h-full">
          <Card className="h-full">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Critical Certificates</h2>
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
                    required
                    error={fieldErrors.tas_badge_expiry_date}
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
                    dateId="dbs_dates_ignored" // DBS often doesn't have strict expiry but good to have file
                    dateVal=""
                    fileId="dbs_file"
                    fileVal={fileUploads.dbs_file}
                  />
                </div>

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
                    {/* Always show date input if checking completed, or purely optional? Keeping visible for editing */}
                    {t.completed && (
                      <input
                        type="date"
                        name={`${t.id}_date`}
                        value={t.date}
                        onChange={handleInputChange}
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
                    <Input type="date" name="utility_bill_date" value={formData.utility_bill_date} onChange={handleInputChange} max="9999-12-31" className="h-7 text-xs" />
                    <CompactFileUpload id="utility_bill_file" onChange={handleFileChange} file={fileUploads.utility_bill_file} />
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
        <SubjectDocumentsChecklist subjectType="pa" subjectId={assistant.employee_id} />
      </div>
    </div>
  )
}
