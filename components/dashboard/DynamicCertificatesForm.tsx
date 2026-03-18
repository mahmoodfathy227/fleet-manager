"use client"

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { AlertCircle } from 'lucide-react'

type DocumentRequirement = {
  id: string
  name: string
  code: string | null
  subject_type: string
  requires_expiry: boolean
  requires_upload: boolean
  requires_number: boolean
  criticality: string
  is_required: boolean
  is_active: boolean
}

type CertificateFormData = {
  certificate_number: string
  expiry_date: string
  issue_date: string
  file: File | null
}

type CertificatesFormData = Record<string, CertificateFormData>

interface DynamicCertificatesFormProps {
  subjectType: 'driver' | 'pa' | 'vehicle'
  formData: CertificatesFormData
  fileUploads: Record<string, File | null>
  fieldErrors: Record<string, string>
  onFormDataChange: (requirementId: string, field: keyof CertificateFormData, value: string | File | null) => void
  onFileChange: (requirementId: string, file: File | null) => void
  minDate: string
  maxDate: string
}

// CertificateCard component - moved outside to prevent recreation on every render
function CertificateCard({ 
  requirement, 
  certificateData,
  file, 
  fieldErrors, 
  onFormDataChange, 
  onFileChange, 
  minDate, 
  maxDate 
}: { 
  requirement: DocumentRequirement
  certificateData: CertificateFormData
  file: File | null
  fieldErrors: Record<string, string>
  onFormDataChange: (requirementId: string, field: keyof CertificateFormData, value: string | File | null) => void
  onFileChange: (requirementId: string, file: File | null) => void
  minDate: string
  maxDate: string
}) {
  const reqId = requirement.id
  const data = certificateData
  const isCritical = requirement.criticality === 'critical'
  const isRequired = requirement.is_required

  // Determine if this certificate should have a special container (like TAS Badge with number field)
  const hasNumberField = requirement.requires_number
  const hasExpiry = requirement.requires_expiry
  const hasUpload = requirement.requires_upload

  if (hasNumberField) {
    // Special container for certificates with number field (like TAS Badge)
    return (
      <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
        <div className="mb-2">
          <Label htmlFor={`cert_${reqId}_number`} className="text-xs font-semibold text-blue-900">
            {requirement.name} Number
          </Label>
          <input
            type="text"
            id={`cert_${reqId}_number`}
            name={`cert_${reqId}_number`}
            value={data.certificate_number || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              onFormDataChange(reqId, 'certificate_number', e.target.value)
            }}
            placeholder={`e.g. ${requirement.code || requirement.name.toUpperCase()}12345`}
            className="flex w-full rounded-lg border bg-background text-sm h-8 px-2.5 text-xs border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring focus-visible:border-transparent mt-1"
          />
        </div>
        {hasExpiry && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700">{requirement.name} Expiry</span>
              {(isCritical || isRequired) && (
                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">REQUIRED</span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2">
              <CompactDateInput
                id={`cert_${reqId}_expiry`}
                label="Expiry Date"
                value={data.expiry_date}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFormDataChange(reqId, 'expiry_date', e.target.value)}
                required={isRequired || isCritical}
                error={fieldErrors[`cert_${reqId}_expiry`]}
                minDate={minDate}
                maxDate={maxDate}
              />
              {hasUpload && (
                <div>
                  <Label htmlFor={`cert_${reqId}_file`} className="text-xs text-slate-500">
                    Upload Certificate
                  </Label>
                  <CompactFileUpload id={`cert_${reqId}_file`} requirementId={reqId} onChange={onFileChange} file={file} />
                </div>
              )}
            </div>
          </div>
        )}
        {!hasExpiry && hasUpload && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700">{requirement.name}</span>
            </div>
            <div>
              <Label htmlFor={`cert_${reqId}_file`} className="text-xs text-slate-500">
                Upload Certificate
              </Label>
              <CompactFileUpload id={`cert_${reqId}_file`} requirementId={reqId} onChange={onFileChange} file={file} />
            </div>
          </div>
        )}
      </div>
    )
  }

  // Standard certificate card
  return (
    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-700">{requirement.name}</span>
        {(isCritical || isRequired) && (
          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">REQUIRED</span>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2">
        {hasExpiry && (
          <CompactDateInput
            id={`cert_${reqId}_expiry`}
            label="Expiry Date"
            value={data.expiry_date}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFormDataChange(reqId, 'expiry_date', e.target.value)}
            required={isRequired || isCritical}
            error={fieldErrors[`cert_${reqId}_expiry`]}
            minDate={minDate}
            maxDate={maxDate}
          />
        )}
        {hasUpload && (
          <div>
            <Label htmlFor={`cert_${reqId}_file`} className="text-xs text-slate-500">
              Upload Certificate
            </Label>
            <CompactFileUpload id={`cert_${reqId}_file`} requirementId={reqId} onChange={onFileChange} file={file} />
          </div>
        )}
      </div>
    </div>
  )
}

// Helper components moved outside as well
function CompactDateInput({ id, label, value, onChange, required = false, error, minDate, maxDate }: any) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-slate-500">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <Input
        type="date"
        id={id}
        name={id}
        value={value}
        onChange={onChange}
        required={required}
        min={minDate}
        max={maxDate}
        className={`h-8 text-sm ${error ? 'border-red-500 focus:ring-red-500' : ''}`}
      />
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  )
}

function CompactFileUpload({ id, requirementId, onChange, file }: { id: string; requirementId: string; onChange: (requirementId: string, file: File | null) => void; file: File | null }) {
  return (
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
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(requirementId, e.target.files?.[0] || null)}
        className="hidden"
      />
    </div>
  )
}

export function DynamicCertificatesForm({
  subjectType,
  formData,
  fileUploads,
  fieldErrors,
  onFormDataChange,
  onFileChange,
  minDate,
  maxDate,
}: DynamicCertificatesFormProps) {
  const supabase = createClient()
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadRequirements = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: reqError } = await supabase
          .from('document_requirements')
          .select('*')
          .eq('subject_type', subjectType)
          .eq('is_active', true)
          .order('name')

        if (reqError) throw reqError
        setRequirements(data || [])
      } catch (err: any) {
        setError(err.message || 'Failed to load certificate requirements')
      } finally {
        setLoading(false)
      }
    }
    loadRequirements()
  }, [subjectType])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <span className="text-sm text-slate-500">Loading certificate requirements...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
        {error}
      </div>
    )
  }

  if (requirements.length === 0) {
    return (
      <div className="text-center p-4 text-sm text-slate-500">
        No certificate requirements configured for {subjectType}s.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {requirements.map((requirement) => {
        const reqId = requirement.id
        const existingData = formData[reqId]
        // Create a stable object with default values
        const certificateData: CertificateFormData = {
          certificate_number: existingData?.certificate_number || '',
          expiry_date: existingData?.expiry_date || '',
          issue_date: existingData?.issue_date || '',
          file: existingData?.file || null
        }
        const file = fileUploads[reqId] || null
        
        return (
          <CertificateCard 
            key={requirement.id} 
            requirement={requirement}
            certificateData={certificateData}
            file={file}
            fieldErrors={fieldErrors}
            onFormDataChange={onFormDataChange}
            onFileChange={onFileChange}
            minDate={minDate}
            maxDate={maxDate}
          />
        )
      })}
    </div>
  )
}
