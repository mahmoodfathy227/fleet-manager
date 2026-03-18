'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ArrowLeft, AlertCircle, Upload, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { DynamicCertificatesForm } from '@/components/dashboard/DynamicCertificatesForm'

const defaultDriverForm = {
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
  safeguarding_training_completed: false,
  safeguarding_training_date: '',
  tas_pats_training_completed: false,
  tas_pats_training_date: '',
  psa_training_completed: false,
  psa_training_date: '',
  additional_notes: '',
}

const defaultPAForm = {
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
}

const driverFileKeys = ['tas_badge_file', 'dbs_file', 'first_aid_file', 'passport_file', 'driving_license_file', 'cpc_file', 'utility_bill_file', 'birth_cert_file', 'marriage_cert_file', 'photo_file', 'private_hire_badge_file', 'paper_licence_file', 'taxi_plate_photo_file', 'logbook_file', 'badge_photo_file'] as const
const paFileKeys = ['tas_badge_file', 'dbs_file', 'first_aid_file', 'passport_file', 'utility_bill_file', 'birth_cert_file', 'marriage_cert_file', 'photo_file', 'paper_licence_file', 'taxi_plate_photo_file', 'badge_photo_file'] as const

export default function CreateEmployeePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [redirectTo, setRedirectTo] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [formData, setFormData] = useState({
    full_name: '',
    role: '',
    employment_status: 'Active',
    phone_number: '',
    personal_email: '',
    address: '',
    next_of_kin: '',
    date_of_birth: '',
    start_date: '',
    end_date: '',
  })
  const [schools, setSchools] = useState<{ id: number; name: string }[]>([])
  const [assignedSchoolIds, setAssignedSchoolIds] = useState<number[]>([])

  const [driverForm, setDriverForm] = useState(defaultDriverForm)
  const [paForm, setPAForm] = useState(defaultPAForm)
  const [driverFiles, setDriverFiles] = useState<Record<string, File | null>>(Object.fromEntries(driverFileKeys.map(k => [k, null])))
  const [paFiles, setPAFiles] = useState<Record<string, File | null>>(Object.fromEntries(paFileKeys.map(k => [k, null])))

  const minYear = 1900
  const maxYear = new Date().getFullYear() + 20
  const minDate = `${minYear}-01-01`
  const maxDate = `${maxYear}-12-31`

  const [driverCertificatesFormData, setDriverCertificatesFormData] = useState<Record<string, { certificate_number: string; expiry_date: string; issue_date: string; file: File | null }>>({})
  const [driverCertificatesFileUploads, setDriverCertificatesFileUploads] = useState<Record<string, File | null>>({})
  const [paCertificatesFormData, setPaCertificatesFormData] = useState<Record<string, { certificate_number: string; expiry_date: string; issue_date: string; file: File | null }>>({})
  const [paCertificatesFileUploads, setPaCertificatesFileUploads] = useState<Record<string, File | null>>({})

  const handleDriverCertificateFormDataChange = useCallback((requirementId: string, field: string, value: string | File | null) => {
    setDriverCertificatesFormData(prev => ({
      ...prev,
      [requirementId]: {
        ...(prev[requirementId] || { certificate_number: '', expiry_date: '', issue_date: '', file: null }),
        [field]: value,
      }
    }))
  }, [])
  const handleDriverCertificateFileChange = (requirementId: string, file: File | null) => {
    setDriverCertificatesFileUploads(prev => ({ ...prev, [requirementId]: file }))
    handleDriverCertificateFormDataChange(requirementId, 'file', file)
  }
  const handlePaCertificateFormDataChange = useCallback((requirementId: string, field: string, value: string | File | null) => {
    setPaCertificatesFormData(prev => ({
      ...prev,
      [requirementId]: {
        ...(prev[requirementId] || { certificate_number: '', expiry_date: '', issue_date: '', file: null }),
        [field]: value,
      }
    }))
  }, [])
  const handlePaCertificateFileChange = (requirementId: string, file: File | null) => {
    setPaCertificatesFileUploads(prev => ({ ...prev, [requirementId]: file }))
    handlePaCertificateFormDataChange(requirementId, 'file', file)
  }

  const handleDriverInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setDriverForm(prev => ({ ...prev, [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }))
    if (fieldErrors[name]) setFieldErrors(prev => ({ ...prev, [name]: '' }))
  }
  const handlePAInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    setPAForm(prev => ({ ...prev, [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }))
    if (fieldErrors[name]) setFieldErrors(prev => ({ ...prev, [name]: '' }))
  }
  const setDriverFile = (key: string, file: File | null) => setDriverFiles(prev => ({ ...prev, [key]: file }))
  const setPAFile = (key: string, file: File | null) => setPAFiles(prev => ({ ...prev, [key]: file }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setLoading(true)

    try {
      const role = formData.role
      // TAS Badge and other certs are now in Critical Certificates (dynamic requirements); no legacy field validation.

      let startDate: string | null = formData.start_date.trim() || null
      let endDate: string | null = formData.end_date.trim() || null
      if (startDate) {
        const startDateObj = new Date(startDate)
        if (isNaN(startDateObj.getTime())) throw new Error('Start Date: Please enter a valid date (YYYY-MM-DD format)')
      }
      if (endDate) {
        const endDateObj = new Date(endDate)
        if (isNaN(endDateObj.getTime())) throw new Error('End Date: Please enter a valid date (YYYY-MM-DD format)')
        if (startDate && new Date(endDate) < new Date(startDate)) throw new Error('End Date must be after or equal to Start Date')
      }
      const dateOfBirth = formData.date_of_birth.trim() || null
      if (dateOfBirth) {
        if (isNaN(new Date(dateOfBirth).getTime())) throw new Error('Date of Birth: Please enter a valid date (YYYY-MM-DD format)')
      }

      const insertData: any = {
        full_name: formData.full_name,
        role: formData.role || null,
        employment_status: formData.employment_status,
        phone_number: formData.phone_number || null,
        personal_email: formData.personal_email || null,
        address: formData.address || null,
        next_of_kin: formData.next_of_kin.trim() || null,
        date_of_birth: dateOfBirth,
        start_date: startDate,
        end_date: endDate,
      }

      const { data: empData, error: empError } = await supabase.from('employees').insert([insertData]).select()
      if (empError) throw empError
      const employeeId = empData?.[0]?.id
      if (!employeeId) throw new Error('Failed to create employee')

      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_name: 'employees', record_id: employeeId, action: 'CREATE' }),
      })

      if (role === 'Driver') {
        const fileKeyToDocType: Record<string, string> = {
          tas_badge_file: 'TAS Badge', dbs_file: 'DBS Certificate', first_aid_file: 'First Aid Certificate',
          passport_file: 'Passport', driving_license_file: 'Driving License', cpc_file: 'CPC Certificate',
          utility_bill_file: 'Utility Bill', birth_cert_file: 'Birth Certificate', marriage_cert_file: 'Marriage Certificate',
          photo_file: 'Photo', private_hire_badge_file: 'Private Hire Badge', paper_licence_file: 'Paper Licence',
          taxi_plate_photo_file: 'Taxi Plate Photo', logbook_file: 'Logbook', badge_photo_file: 'ID Badge Photo',
        }
        const uploadedDocs: Array<{ fileUrl: string; fileName: string; fileType: string; docType: string; filePath: string }> = []
        for (const [key, file] of Object.entries(driverFiles)) {
          if (file) {
            const ext = file.name.split('.').pop()
            const path = `drivers/${employeeId}/${key}_${Date.now()}.${ext}`
            const { data: up, error: upErr } = await supabase.storage.from('DRIVER_DOCUMENTS').upload(path, file)
            if (upErr) throw upErr
            const { data: { publicUrl } } = supabase.storage.from('DRIVER_DOCUMENTS').getPublicUrl(path)
            uploadedDocs.push({ fileUrl: publicUrl, fileName: file.name, fileType: file.type || 'application/octet-stream', docType: fileKeyToDocType[key] || 'Certificate', filePath: path })
          }
        }
        const driverData = {
          employee_id: employeeId,
          tas_badge_number: driverForm.tas_badge_number || null,
          tas_badge_expiry_date: driverForm.tas_badge_expiry_date || null,
          dbs_number: driverForm.dbs_number || null,
          psv_license: driverForm.psv_license,
          first_aid_certificate_expiry_date: driverForm.first_aid_certificate_expiry_date || null,
          passport_expiry_date: driverForm.passport_expiry_date || null,
          driving_license_expiry_date: driverForm.driving_license_expiry_date || null,
          cpc_expiry_date: driverForm.cpc_expiry_date || null,
          utility_bill_date: driverForm.utility_bill_date || null,
          birth_certificate: driverForm.birth_certificate,
          marriage_certificate: driverForm.marriage_certificate,
          photo_taken: driverForm.photo_taken,
          private_hire_badge: driverForm.private_hire_badge,
          paper_licence: driverForm.paper_licence,
          taxi_plate_photo: driverForm.taxi_plate_photo,
          logbook: driverForm.logbook,
          safeguarding_training_completed: driverForm.safeguarding_training_completed,
          safeguarding_training_date: driverForm.safeguarding_training_date || null,
          tas_pats_training_completed: driverForm.tas_pats_training_completed,
          tas_pats_training_date: driverForm.tas_pats_training_date || null,
          psa_training_completed: driverForm.psa_training_completed,
          psa_training_date: driverForm.psa_training_date || null,
          additional_notes: driverForm.additional_notes || null,
          spare_driver: driverForm.spare_driver,
          self_employed: driverForm.self_employed,
        }
        const { error: driverErr } = await supabase.from('drivers').insert([driverData])
        if (driverErr) throw driverErr
        await fetch('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table_name: 'drivers', record_id: employeeId, action: 'CREATE' }) })
        if (uploadedDocs.length > 0) {
          const docRecords = uploadedDocs.map(doc => ({ file_name: doc.fileName, file_type: doc.fileType, file_path: doc.filePath, file_url: doc.fileUrl, doc_type: doc.docType, uploaded_by: null }))
          const { data: insertedDocs } = await supabase.from('documents').insert(docRecords).select('id')
          if (insertedDocs?.length) {
            for (const doc of insertedDocs) {
              await supabase.from('document_driver_links').insert({ document_id: doc.id, driver_employee_id: employeeId })
            }
          }
        }
        if (Object.keys(driverCertificatesFormData).length > 0 || Object.keys(driverCertificatesFileUploads).length > 0) {
          const norm = (id: string) => String(id || '').toLowerCase().trim()
          let { data: autoCreatedDocs } = await supabase.from('subject_documents').select('id, requirement_id').eq('subject_type', 'driver').eq('driver_employee_id', employeeId)
          autoCreatedDocs = autoCreatedDocs || []
          const driverReqIds = Array.from(new Set([...Object.keys(driverCertificatesFormData), ...Object.keys(driverCertificatesFileUploads)]))
          for (const requirementId of driverReqIds) {
            let existing = autoCreatedDocs?.find(d => norm(d.requirement_id) === norm(requirementId))
            if (!existing) {
              const { data: created, error: insertErr } = await supabase.from('subject_documents').insert({ requirement_id: requirementId, subject_type: 'driver', driver_employee_id: employeeId, status: 'missing' }).select('id, requirement_id').single()
              if (created) {
                autoCreatedDocs = [...autoCreatedDocs, created]
                existing = created
              } else if (insertErr) {
                const { data: refetched } = await supabase.from('subject_documents').select('id, requirement_id').eq('subject_type', 'driver').eq('driver_employee_id', employeeId)
                if (refetched?.length) {
                  autoCreatedDocs = refetched
                  existing = refetched.find(d => norm(d.requirement_id) === norm(requirementId)) ?? undefined
                }
              }
            }
            if (existing) {
              const certData = driverCertificatesFormData[requirementId]
              if (certData && (certData.certificate_number || certData.expiry_date || certData.issue_date)) {
                await supabase.from('subject_documents').update({
                  certificate_number: certData.certificate_number || null,
                  expiry_date: certData.expiry_date || null,
                  issue_date: certData.issue_date || null,
                  status: certData.expiry_date || certData.certificate_number ? 'valid' : undefined,
                }).eq('id', existing.id)
              }
            }
          }
          for (const [requirementId, file] of Object.entries(driverCertificatesFileUploads)) {
            if (!file) continue
            const ext = file.name.split('.').pop()
            const path = `drivers/${employeeId}/certificates/${requirementId}_${Date.now()}.${ext}`
            const { data: up } = await supabase.storage.from('DRIVER_DOCUMENTS').upload(path, file)
            if (up) {
              const { data: { publicUrl } } = supabase.storage.from('DRIVER_DOCUMENTS').getPublicUrl(path)
              const { data: docRecord } = await supabase.from('documents').insert({ file_name: file.name, file_type: file.type || 'application/octet-stream', file_path: path, file_url: publicUrl, doc_type: 'Certificate', uploaded_by: null }).select('id').single()
              if (docRecord) {
                await supabase.from('document_driver_links').insert({ document_id: docRecord.id, driver_employee_id: employeeId })
                const existing = autoCreatedDocs.find(d => norm(d.requirement_id) === norm(requirementId))
                if (existing) {
                  await supabase.from('document_subject_document_links').insert({ document_id: docRecord.id, subject_document_id: existing.id })
                }
              }
            }
          }
        }
        setSuccess(true)
        setRedirectTo('/dashboard/drivers')
      } else if (role === 'PA') {
        const fileKeyToDocType: Record<string, string> = {
          tas_badge_file: 'TAS Badge', dbs_file: 'DBS Certificate', first_aid_file: 'First Aid Certificate',
          passport_file: 'Passport', utility_bill_file: 'Utility Bill', birth_cert_file: 'Birth Certificate', marriage_cert_file: 'Marriage Certificate',
          photo_file: 'Photo', paper_licence_file: 'Paper Licence',
          taxi_plate_photo_file: 'Taxi Plate Photo', badge_photo_file: 'ID Badge Photo',
        }
        const uploadedDocs: Array<{ fileUrl: string; fileName: string; fileType: string; docType: string; filePath: string }> = []
        for (const [key, file] of Object.entries(paFiles)) {
          if (file) {
            const ext = file.name.split('.').pop()
            const path = `assistants/${employeeId}/${key}_${Date.now()}.${ext}`
            const { data: up, error: upErr } = await supabase.storage.from('DRIVER_DOCUMENTS').upload(path, file)
            if (upErr) throw upErr
            const { data: { publicUrl } } = supabase.storage.from('DRIVER_DOCUMENTS').getPublicUrl(path)
            uploadedDocs.push({ fileUrl: publicUrl, fileName: file.name, fileType: file.type || 'application/octet-stream', docType: fileKeyToDocType[key] || 'Certificate', filePath: path })
          }
        }
        const paData = {
          employee_id: employeeId,
          tas_badge_number: paForm.tas_badge_number || null,
          tas_badge_expiry_date: paForm.tas_badge_expiry_date || null,
          dbs_number: paForm.dbs_number || null,
          first_aid_certificate_expiry_date: paForm.first_aid_certificate_expiry_date || null,
          passport_expiry_date: paForm.passport_expiry_date || null,
          utility_bill_date: paForm.utility_bill_date || null,
          birth_certificate: paForm.birth_certificate,
          marriage_certificate: paForm.marriage_certificate,
          photo_taken: paForm.photo_taken,
          paper_licence: paForm.paper_licence,
          taxi_plate_photo: paForm.taxi_plate_photo,
          safeguarding_training_completed: paForm.safeguarding_training_completed,
          safeguarding_training_date: paForm.safeguarding_training_date || null,
          tas_pats_training_completed: paForm.tas_pats_training_completed,
          tas_pats_training_date: paForm.tas_pats_training_date || null,
          psa_training_completed: paForm.psa_training_completed,
          psa_training_date: paForm.psa_training_date || null,
          additional_notes: paForm.additional_notes || null,
          spare_pa: paForm.spare_pa,
        }
        const { data: paResult, error: paErr } = await supabase.from('passenger_assistants').insert([paData]).select()
        if (paErr) throw paErr
        await fetch('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ table_name: 'passenger_assistants', record_id: paResult?.[0]?.id ?? employeeId, action: 'CREATE' }) })
        if (uploadedDocs.length > 0) {
          const docRecords = uploadedDocs.map(doc => ({ file_url: JSON.stringify([doc.fileUrl]), file_name: doc.fileName, file_type: doc.fileType, file_path: doc.fileUrl, doc_type: doc.docType, uploaded_at: new Date().toISOString() }))
          const { data: insertedDocs } = await supabase.from('documents').insert(docRecords).select('id')
          if (insertedDocs?.length) {
            for (const doc of insertedDocs) {
              await supabase.from('document_pa_links').insert({ document_id: doc.id, pa_employee_id: employeeId })
            }
          }
        }
        if (Object.keys(paCertificatesFormData).length > 0 || Object.keys(paCertificatesFileUploads).length > 0) {
          const norm = (id: string) => String(id || '').toLowerCase().trim()
          let { data: autoCreatedDocs } = await supabase.from('subject_documents').select('id, requirement_id').eq('subject_type', 'pa').eq('pa_employee_id', employeeId)
          autoCreatedDocs = autoCreatedDocs || []
          const paReqIds = Array.from(new Set([...Object.keys(paCertificatesFormData), ...Object.keys(paCertificatesFileUploads)]))
          for (const requirementId of paReqIds) {
            let existing = autoCreatedDocs?.find(d => norm(d.requirement_id) === norm(requirementId))
            if (!existing) {
              const { data: created, error: insertErr } = await supabase.from('subject_documents').insert({ requirement_id: requirementId, subject_type: 'pa', pa_employee_id: employeeId, status: 'missing' }).select('id, requirement_id').single()
              if (created) {
                autoCreatedDocs = [...autoCreatedDocs, created]
                existing = created
              } else if (insertErr) {
                const { data: refetched } = await supabase.from('subject_documents').select('id, requirement_id').eq('subject_type', 'pa').eq('pa_employee_id', employeeId)
                if (refetched?.length) {
                  autoCreatedDocs = refetched
                  existing = refetched.find(d => norm(d.requirement_id) === norm(requirementId)) ?? undefined
                }
              }
            }
            if (existing) {
              const certData = paCertificatesFormData[requirementId]
              if (certData && (certData.certificate_number || certData.expiry_date || certData.issue_date)) {
                await supabase.from('subject_documents').update({
                  certificate_number: certData.certificate_number || null,
                  expiry_date: certData.expiry_date || null,
                  issue_date: certData.issue_date || null,
                  status: certData.expiry_date || certData.certificate_number ? 'valid' : undefined,
                }).eq('id', existing.id)
              }
            }
          }
          for (const [requirementId, file] of Object.entries(paCertificatesFileUploads)) {
            if (!file) continue
            const ext = file.name.split('.').pop()
            const path = `assistants/${employeeId}/certificates/${requirementId}_${Date.now()}.${ext}`
            const { data: up } = await supabase.storage.from('PA_DOCUMENTS').upload(path, file)
            if (up) {
              const { data: { publicUrl } } = supabase.storage.from('PA_DOCUMENTS').getPublicUrl(path)
              const { data: docRecord } = await supabase.from('documents').insert({ file_url: JSON.stringify([publicUrl]), file_name: file.name, file_type: file.type || 'application/octet-stream', file_path: path, doc_type: 'Certificate', uploaded_at: new Date().toISOString() }).select('id').single()
              if (docRecord) {
                await supabase.from('document_pa_links').insert({ document_id: docRecord.id, pa_employee_id: employeeId })
                const existing = autoCreatedDocs.find(d => norm(d.requirement_id) === norm(requirementId))
                if (existing) {
                  await supabase.from('document_subject_document_links').insert({ document_id: docRecord.id, subject_document_id: existing.id })
                }
              }
            }
          }
        }
        setSuccess(true)
        setRedirectTo('/dashboard/assistants')
      } else {
        if (role === 'Coordinator' && assignedSchoolIds.length > 0) {
          await supabase.from('coordinator_school_assignments').insert(
            assignedSchoolIds.map((schoolId) => ({ employee_id: employeeId, school_id: schoolId }))
          )
        }
        setSuccess(true)
        setRedirectTo('/dashboard/employees')
      }
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating the employee')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!success || !redirectTo) return
    const t = setTimeout(() => {
      router.push(redirectTo)
    }, 2000)
    return () => clearTimeout(t)
  }, [success, redirectTo, router])

  useEffect(() => {
    async function loadSchools() {
      const sb = createClient()
      const { data } = await sb.from('schools').select('id, name').order('name')
      if (data) setSchools(data)
    }
    loadSchools()
  }, [])

  const CompactFileUploadDriver = ({ id, file }: { id: string; file: File | null }) => (
    <div className="flex items-center gap-2 mt-1 w-full">
      <label htmlFor={`driver_${id}`} className="cursor-pointer bg-[#023E8A] text-white px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider hover:bg-[#023E8A]/90 shrink-0 flex items-center gap-1">
        Upload
      </label>
      <div className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[10px] text-slate-500 truncate flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${file ? 'bg-green-500' : 'bg-slate-300'}`} />
        <span className={`truncate ${file ? 'text-slate-700 font-medium' : 'text-slate-400 italic'}`}>{file?.name || 'No file selected'}</span>
      </div>
      <input type="file" id={`driver_${id}`} accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setDriverFile(id, e.target.files?.[0] || null)} />
    </div>
  )
  const CompactFileUploadPA = ({ id, file }: { id: string; file: File | null }) => (
    <div className="flex items-center gap-2 mt-1 w-full">
      <label htmlFor={`pa_${id}`} className="cursor-pointer bg-[#023E8A] text-white px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider hover:bg-[#023E8A]/90 shrink-0 flex items-center gap-1">
        Upload
      </label>
      <div className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[10px] text-slate-500 truncate flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${file ? 'bg-green-500' : 'bg-slate-300'}`} />
        <span className={`truncate ${file ? 'text-slate-700 font-medium' : 'text-slate-400 italic'}`}>{file?.name || 'No file selected'}</span>
      </div>
      <input type="file" id={`pa_${id}`} accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setPAFile(id, e.target.files?.[0] || null)} />
    </div>
  )

  return (
    <div className="max-w-[73.6rem] mx-auto space-y-4">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/employees">
          <Button variant="outline" size="sm" className="h-9 px-3 gap-2 text-slate-600 border-slate-300 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Add New Employee</h1>
          <p className="text-sm text-slate-500">Create employee with role-specific details</p>
        </div>
      </div>

      {success && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-start gap-2">
          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-green-700 font-medium">Employee created successfully. Redirecting...</div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Main Form Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Employee Info Section Header */}
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-700">Employee Information</h2>
        </div>
        <div className="p-4">
          <form onSubmit={handleSubmit} className="space-y-4" id="create-employee-form">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="role" className="text-xs font-medium text-slate-600">Role *</Label>
                <Select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="h-9"
                >
                  <option value="">Select role first</option>
                  <option value="Driver">Driver</option>
                  <option value="PA">Passenger Assistant</option>
                  <option value="Coordinator">Coordinator</option>
                  <option value="Admin">Admin</option>
                  <option value="Other">Other</option>
                </Select>
                <p className="text-xs text-gray-500">Choosing Driver or PA will show role-specific details below.</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="full_name" className="text-xs font-medium text-slate-600">Full Name *</Label>
                <Input
                  id="full_name"
                  required
                  value={formData.full_name}
                  onChange={(e) =>
                    setFormData({ ...formData, full_name: e.target.value })
                  }
                  className="h-9"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="employment_status" className="text-xs font-medium text-slate-600">Employment Status</Label>
                <Select
                  id="employment_status"
                  value={formData.employment_status}
                  onChange={(e) =>
                    setFormData({ ...formData, employment_status: e.target.value })
                  }
                  className="h-9"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="On Leave">On Leave</option>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="phone_number" className="text-xs font-medium text-slate-600">Phone Number</Label>
                <Input
                  id="phone_number"
                  type="tel"
                  value={formData.phone_number}
                  onChange={(e) =>
                    setFormData({ ...formData, phone_number: e.target.value })
                  }
                  className="h-9"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="personal_email" className="text-xs font-medium text-slate-600">Personal Email</Label>
                <Input
                  id="personal_email"
                  type="email"
                  value={formData.personal_email}
                  onChange={(e) =>
                    setFormData({ ...formData, personal_email: e.target.value })
                  }
                  className="h-9"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="address" className="text-xs font-medium text-slate-600">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                  placeholder="Full address..."
                  className="h-9"
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label htmlFor="next_of_kin" className="text-xs font-medium text-slate-600">Next of Kin</Label>
                <Input
                  id="next_of_kin"
                  value={formData.next_of_kin}
                  onChange={(e) =>
                    setFormData({ ...formData, next_of_kin: e.target.value })
                  }
                  placeholder="Name and/or contact details..."
                  className="h-9"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="date_of_birth" className="text-xs font-medium text-slate-600">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) =>
                    setFormData({ ...formData, date_of_birth: e.target.value })
                  }
                  max="9999-12-31"
                  className="h-9"
                />
                <p className="text-xs text-slate-500">Optional</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="start_date" className="text-xs font-medium text-slate-600">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value })
                  }
                  max="9999-12-31"
                  className="h-9"
                />
                <p className="text-xs text-slate-500">Optional</p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="end_date" className="text-xs font-medium text-slate-600">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, end_date: e.target.value })
                  }
                  max="9999-12-31"
                  className="h-9"
                />
                <p className="text-xs text-slate-500">Optional</p>
              </div>

              {formData.role === 'Coordinator' && (
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs font-medium text-slate-600">Assigned Schools</Label>
                  <p className="text-xs text-slate-500 mb-1">Select schools this coordinator is responsible for.</p>
                  <div className="border border-slate-200 rounded-lg p-2 max-h-32 overflow-y-auto bg-slate-50">
                    {schools.length === 0 ? (
                      <p className="text-xs text-slate-500">No schools found. Create schools first.</p>
                    ) : (
                      <div className="grid gap-1 md:grid-cols-2">
                        {schools.map((school) => (
                          <label key={school.id} className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-white">
                            <input
                              type="checkbox"
                              checked={assignedSchoolIds.includes(school.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAssignedSchoolIds((prev) => [...prev, school.id])
                                } else {
                                  setAssignedSchoolIds((prev) => prev.filter((id) => id !== school.id))
                                }
                              }}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-[#023E8A] focus:ring-[#023E8A]"
                            />
                            <span className="text-xs text-slate-700">{school.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Driver details – same layout as external Add New Driver form */}
            {formData.role === 'Driver' && (
              <div className="border-t border-slate-200 pt-6 space-y-4">
                <h3 className="text-sm font-semibold text-slate-700">Driver Details (matches Add New Driver form)</h3>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                  <div className="lg:col-span-3 flex flex-col gap-4">
                    <Card>
                      <CardContent className="p-4 space-y-4">
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 border-b pb-2">Identity</h2>
                        <div className="space-y-4">
                          <div className="relative group">
                            <div className="w-full aspect-square bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 hover:border-primary/50 transition-colors cursor-pointer overflow-hidden">
                              <input type="file" id="driver_badge_photo_file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setDriverFile('badge_photo_file', e.target.files?.[0] || null)} />
                              {driverFiles.badge_photo_file ? <div className="relative w-full h-full"><p className="absolute bottom-2 left-0 right-0 text-center text-xs bg-black/50 text-white py-1">Photo Selected</p></div> : <><Upload className="h-8 w-8 mb-2" /><span className="text-xs font-medium">Upload Badge Photo</span></>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                            <input type="checkbox" id="spare_driver" name="spare_driver" checked={driverForm.spare_driver} onChange={handleDriverInput} className="rounded border-amber-400 text-amber-600 focus:ring-amber-500" />
                            <div className="flex-1">
                              <Label htmlFor="spare_driver" className="text-sm font-semibold text-amber-900 cursor-pointer">Mark as Spare Driver</Label>
                              <p className="text-[10px] text-amber-700 leading-tight mt-0.5">Not assigned to specific route, available for cover.</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <input type="checkbox" id="self_employed" name="self_employed" checked={driverForm.self_employed} onChange={handleDriverInput} className="rounded border-slate-300 text-[#023E8A] focus:ring-[#023E8A]" />
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
                            { id: 'private_hire_badge', label: 'Private Hire Badge' },
                            { id: 'dbs_number', label: 'DBS Checked', note: 'Enter number below in Certificates' },
                          ].map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded transition-colors">
                              <Label htmlFor={item.id} className="text-sm text-slate-700 cursor-pointer flex-1">{item.label}</Label>
                              {item.id === 'dbs_number' ? (
                                <span className="text-xs text-slate-500">Use Certificates</span>
                              ) : (
                                <input type="checkbox" id={item.id} name={item.id} checked={(driverForm as Record<string, unknown>)[item.id] as boolean} onChange={handleDriverInput} className="rounded border-slate-300 text-primary focus:ring-primary" />
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="lg:col-span-5 flex flex-col gap-4">
                    <Card className="h-full">
                      <CardContent className="p-4 space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Critical Certificates</h2>
                          <div className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                            <AlertCircle className="h-3 w-3" />
                            <span>Expiry tracking enabled</span>
                          </div>
                        </div>
                        <DynamicCertificatesForm subjectType="driver" formData={driverCertificatesFormData} fileUploads={driverCertificatesFileUploads} fieldErrors={fieldErrors} onFormDataChange={handleDriverCertificateFormDataChange} onFileChange={handleDriverCertificateFileChange} minDate={minDate} maxDate={maxDate} />
                      </CardContent>
                    </Card>
                  </div>
                  <div className="lg:col-span-4 flex flex-col gap-4">
                    <Card>
                      <CardContent className="p-4 space-y-4">
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 border-b pb-2">Training Status</h2>
                        <div className="space-y-3">
                          {[
                            { id: 'safeguarding_training', label: 'Safeguarding', completed: driverForm.safeguarding_training_completed, date: driverForm.safeguarding_training_date },
                            { id: 'tas_pats_training', label: 'TAS PATS', completed: driverForm.tas_pats_training_completed, date: driverForm.tas_pats_training_date },
                            { id: 'psa_training', label: 'PSA Training', completed: driverForm.psa_training_completed, date: driverForm.psa_training_date },
                          ].map((t) => (
                            <div key={t.id} className={`p-3 rounded-lg border text-sm ${t.completed ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className={`font-semibold ${t.completed ? 'text-green-800' : 'text-slate-600'}`}>{t.label}</span>
                                <input type="checkbox" name={`${t.id}_completed`} checked={t.completed} onChange={handleDriverInput} className="rounded border-slate-300 text-green-600 focus:ring-green-500" />
                              </div>
                              {t.completed && <input type="date" name={`${t.id}_date`} value={t.date} onChange={handleDriverInput} min={minDate} max="9999-12-31" className="w-full h-7 text-xs border-slate-200 rounded bg-white px-2" />}
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
                              <Input type="date" name="utility_bill_date" value={driverForm.utility_bill_date} onChange={handleDriverInput} min={minDate} max="9999-12-31" className="h-7 text-xs" />
                              <CompactFileUploadDriver id="utility_bill_file" file={driverFiles.utility_bill_file} />
                            </div>
                          </div>
                          <div className="space-y-2 pt-2 border-t">
                            <Label className="text-sm font-semibold">Additional Files</Label>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {['Paper Licence', 'Birth Certificate', 'Marriage Certificate'].map((label) => {
                                const key = label === 'Paper Licence' ? 'paper_licence_file' : label === 'Birth Certificate' ? 'birth_cert_file' : 'marriage_cert_file'
                                return (
                                  <div key={label} className="flex flex-col gap-1">
                                    <span className="text-slate-500 truncate">{label}</span>
                                    <CompactFileUploadDriver id={key} file={driverFiles[key]} />
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                          <div className="pt-2">
                            <Label htmlFor="driver_additional_notes" className="text-sm font-semibold">Notes</Label>
                            <textarea id="driver_additional_notes" name="additional_notes" value={driverForm.additional_notes} onChange={handleDriverInput} rows={3} className="w-full mt-1 rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary min-h-[80px]" placeholder="Private HR notes..." />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            )}

            {/* Passenger Assistant details – same layout as external Add New PA form */}
            {formData.role === 'PA' && (
              <div className="border-t border-slate-200 pt-6 space-y-4">
                <h3 className="text-sm font-semibold text-slate-700">Passenger Assistant Details (matches Add New PA form)</h3>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                  <div className="lg:col-span-3 flex flex-col gap-4">
                    <Card>
                      <CardContent className="p-4 space-y-4">
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 border-b pb-2">Identity</h2>
                        <div className="space-y-4">
                          <div className="relative group">
                            <div className="w-full aspect-square bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 hover:border-primary/50 transition-colors cursor-pointer overflow-hidden">
                              <input type="file" id="pa_badge_photo_file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setPAFile('badge_photo_file', e.target.files?.[0] || null)} />
                              {paFiles.badge_photo_file ? <div className="relative w-full h-full"><p className="absolute bottom-2 left-0 right-0 text-center text-xs bg-black/50 text-white py-1">Photo Selected</p></div> : <><Upload className="h-8 w-8 mb-2" /><span className="text-xs font-medium">Upload Badge Photo</span></>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                            <input type="checkbox" id="spare_pa" name="spare_pa" checked={paForm.spare_pa} onChange={handlePAInput} className="rounded border-amber-400 text-amber-600 focus:ring-amber-500" />
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
                            { id: 'birth_certificate', label: 'Birth Certificate' },
                          ].map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded transition-colors">
                              <Label htmlFor={item.id} className="text-sm text-slate-700 cursor-pointer flex-1">{item.label}</Label>
                              <input type="checkbox" id={item.id} name={item.id} checked={(paForm as Record<string, unknown>)[item.id] as boolean} onChange={handlePAInput} className="rounded border-slate-300 text-primary focus:ring-primary" />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="lg:col-span-5 flex flex-col gap-4">
                    <Card className="h-full">
                      <CardContent className="p-4 space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Critical Certificates</h2>
                          <div className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                            <AlertCircle className="h-3 w-3" />
                            <span>Expiry tracking enabled</span>
                          </div>
                        </div>
                        <DynamicCertificatesForm subjectType="pa" formData={paCertificatesFormData} fileUploads={paCertificatesFileUploads} fieldErrors={fieldErrors} onFormDataChange={handlePaCertificateFormDataChange} onFileChange={handlePaCertificateFileChange} minDate={minDate} maxDate={maxDate} />
                      </CardContent>
                    </Card>
                  </div>
                  <div className="lg:col-span-4 flex flex-col gap-4">
                    <Card>
                      <CardContent className="p-4 space-y-4">
                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2 border-b pb-2">Training Status</h2>
                        <div className="space-y-3">
                          {[
                            { id: 'safeguarding_training', label: 'Safeguarding', completed: paForm.safeguarding_training_completed, date: paForm.safeguarding_training_date },
                            { id: 'tas_pats_training', label: 'TAS PATS', completed: paForm.tas_pats_training_completed, date: paForm.tas_pats_training_date },
                          ].map((t) => (
                            <div key={t.id} className={`p-3 rounded-lg border text-sm ${t.completed ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                              <div className="flex items-center justify-between mb-2">
                                <span className={`font-semibold ${t.completed ? 'text-green-800' : 'text-slate-600'}`}>{t.label}</span>
                                <input type="checkbox" name={`${t.id}_completed`} checked={t.completed} onChange={handlePAInput} className="rounded border-slate-300 text-green-600 focus:ring-green-500" />
                              </div>
                              {t.completed && <input type="date" name={`${t.id}_date`} value={t.date} onChange={handlePAInput} min={minDate} max="9999-12-31" className="w-full h-7 text-xs border-slate-200 rounded bg-white px-2" />}
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
                              <Input type="date" name="utility_bill_date" value={paForm.utility_bill_date} onChange={handlePAInput} min={minDate} max="9999-12-31" className="h-7 text-xs" />
                              <CompactFileUploadPA id="utility_bill_file" file={paFiles.utility_bill_file} />
                            </div>
                          </div>
                          <div className="space-y-2 pt-2 border-t">
                            <Label className="text-sm font-semibold">Additional Files</Label>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {['Paper Licence', 'Birth Certificate', 'Marriage Certificate'].map((label) => {
                                const key = label === 'Paper Licence' ? 'paper_licence_file' : label === 'Birth Certificate' ? 'birth_cert_file' : 'marriage_cert_file'
                                return (
                                  <div key={label} className="flex flex-col gap-1">
                                    <span className="text-slate-500 truncate">{label}</span>
                                    <CompactFileUploadPA id={key} file={paFiles[key]} />
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                          <div className="pt-2">
                            <Label htmlFor="pa_additional_notes" className="text-sm font-semibold">Notes</Label>
                            <textarea id="pa_additional_notes" name="additional_notes" value={paForm.additional_notes} onChange={handlePAInput} rows={3} className="w-full mt-1 rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary min-h-[80px]" placeholder="Private HR notes..." />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            )}

            {/* Form Footer */}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Link href="/dashboard/employees">
                <Button type="button" variant="outline" size="sm" className="h-9">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={loading} size="sm" className="h-9">
                {loading
                  ? 'Creating...'
                  : formData.role === 'Driver'
                    ? 'Create Employee & Driver'
                    : formData.role === 'PA'
                      ? 'Create Employee & PA'
                      : 'Create Employee'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

