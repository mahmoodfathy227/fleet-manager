"use client"

import { useEffect, useMemo, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select } from '@/components/ui/Select'
import { Card, CardContent } from '@/components/ui/Card'

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

type LinkedDocument = {
  id: number
  file_name: string | null
  file_url: string | null
  file_path: string | null
}

type SubjectDocument = {
  id: string
  requirement_id: string
  status: string
  certificate_number: string | null
  issue_date: string | null
  expiry_date: string | null
  notes: string | null
  document_requirements?: DocumentRequirement
  document_subject_document_links?: Array<{
    document_id: number
    documents: LinkedDocument | null
  }>
}

type Draft = {
  status: string
  certificate_number: string
  issue_date: string
  expiry_date: string
  notes: string
}

const defaultDraft: Draft = {
  status: 'missing',
  certificate_number: '',
  issue_date: '',
  expiry_date: '',
  notes: '',
}

/** Show linked document(s) for a subject_document in view mode */
function LinkedDocumentsDisplay({ doc }: { doc: SubjectDocument | undefined }) {
  const links = doc?.document_subject_document_links
  const files = links?.map((l) => l.documents).filter(Boolean) as LinkedDocument[] | undefined
  if (!files?.length) return <p className="text-sm text-slate-900 mt-0.5">—</p>
  return (
    <div className="mt-0.5 space-y-1">
      {files.map((f) => (
        <a
          key={f.id}
          href={f.file_url || '#'}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary hover:underline block truncate max-w-[200px]"
          title={f.file_name || 'Open'}
        >
          {f.file_name || 'Document'}
        </a>
      ))}
    </div>
  )
}

/** Storage bucket per entity for dynamic requirement uploads */
const STORAGE_BUCKET_BY_SUBJECT: Record<'driver' | 'pa' | 'vehicle' | 'employee', string> = {
  driver: 'DRIVER_DOCUMENTS',
  pa: 'PA_DOCUMENTS',
  vehicle: 'VEHICLE_DOCUMENTS',
  employee: 'EMPLOYEE_DOCUMENTS',
}

export function SubjectDocumentsChecklist({
  subjectType,
  subjectId,
}: {
  subjectType: 'driver' | 'pa' | 'vehicle' | 'employee'
  subjectId: number
}) {
  const supabase = createClient()
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([])
  const [documents, setDocuments] = useState<SubjectDocument[]>([])
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  const documentsByRequirement = useMemo(() => {
    const map: Record<string, SubjectDocument> = {}
    documents.forEach((doc) => {
      map[doc.requirement_id] = doc
    })
    return map
  }, [documents])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        let res: Response
        try {
          res = await fetch(`/api/admin/subject-documents?subject_type=${subjectType}&subject_id=${subjectId}`)
        } catch (fetchError: any) {
          // Handle network errors (CORS, connection refused, etc.)
          throw new Error(fetchError.message?.includes('fetch') 
            ? 'Network error: Unable to connect to server. Please check your internet connection.'
            : fetchError.message || 'Failed to load documents')
        }
        
        // Handle HTTP errors
        if (!res.ok) {
          let errorMessage = 'Failed to load documents'
          try {
            const errorData = await res.json()
            errorMessage = errorData.error || errorMessage
          } catch {
            // If response is not JSON, use status text
            errorMessage = res.statusText || `Server returned ${res.status}`
          }
          throw new Error(errorMessage)
        }
        
        const data = await res.json()
        setRequirements(data.requirements || [])
        setDocuments(data.documents || [])
        const nextDrafts: Record<string, Draft> = {}
        ;(data.requirements || []).forEach((req: DocumentRequirement) => {
          const existing = (data.documents || []).find((doc: SubjectDocument) => doc.requirement_id === req.id)
          nextDrafts[req.id] = {
            status: existing?.status || 'missing',
            certificate_number: existing?.certificate_number || '',
            issue_date: existing?.issue_date || '',
            expiry_date: existing?.expiry_date || '',
            notes: existing?.notes || '',
          }
        })
        setDrafts(nextDrafts)
      } catch (err: any) {
        // Handle network errors and other fetch failures
        const errorMessage = err.message || 'Failed to load documents. Please check your connection and try again.'
        setError(errorMessage)
        console.error('Error loading subject documents:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [subjectType, subjectId])

  const updateDraft = useCallback((requirementId: string, key: keyof Draft, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [requirementId]: {
        ...(prev[requirementId] || defaultDraft),
        [key]: value,
      },
    }))
  }, [])

  const normId = useCallback((id: string) => String(id || '').toLowerCase().trim(), [])

  const ensureDocument = async (requirementId: string): Promise<SubjectDocument | null> => {
    const existing = documentsByRequirement[requirementId]
    if (existing) return existing
    const existingNorm = documents.find((d) => normId(d.requirement_id) === normId(requirementId))
    if (existingNorm) return existingNorm
    const draft = drafts[requirementId] || defaultDraft
    try {
      let res: Response
      try {
        res = await fetch('/api/admin/subject-documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requirement_id: requirementId,
            subject_type: subjectType,
            subject_id: subjectId,
            status: draft.status,
            certificate_number: draft.certificate_number || null,
            issue_date: draft.issue_date || null,
            expiry_date: draft.expiry_date || null,
            notes: draft.notes || null,
          }),
        })
      } catch (fetchError: any) {
        throw new Error(fetchError.message?.includes('fetch') 
          ? 'Network error: Unable to connect to server. Please check your internet connection.'
          : fetchError.message || 'Failed to create document')
      }
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const errorMessage = errorData?.error || res.statusText || `Server returned ${res.status}`
        if (res.status === 409 || /unique|duplicate/.test(String(errorMessage).toLowerCase())) {
          const refetch = await fetch(`/api/admin/subject-documents?subject_type=${subjectType}&subject_id=${subjectId}`)
          if (refetch.ok) {
            const { documents: refetchedDocs } = await refetch.json()
            const existingDoc = (refetchedDocs || []).find((d: SubjectDocument) => normId(d.requirement_id) === normId(requirementId))
            if (existingDoc) {
              setDocuments((prev) => prev.filter((x) => normId(x.requirement_id) !== normId(requirementId)).concat(existingDoc))
              return existingDoc
            }
          }
        }
        throw new Error(errorMessage)
      }

      const data = await res.json()
      setDocuments((prev) => [data.document, ...prev])
      return data.document as SubjectDocument
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create document. Please check your connection and try again.'
      throw new Error(errorMessage)
    }
  }

  const handleSave = async (requirement: DocumentRequirement) => {
    setSaving((prev) => ({ ...prev, [requirement.id]: true }))
    setError(null)
    try {
      const draft = drafts[requirement.id] || defaultDraft
      const existing = documentsByRequirement[requirement.id]
      if (!existing) {
        await ensureDocument(requirement.id)
        return
      }
      
      let res: Response
      try {
        res = await fetch(`/api/admin/subject-documents/${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: draft.status,
            certificate_number: draft.certificate_number || null,
            issue_date: draft.issue_date || null,
            expiry_date: draft.expiry_date || null,
            notes: draft.notes || null,
          }),
        })
      } catch (fetchError: any) {
        throw new Error(fetchError.message?.includes('fetch') 
          ? 'Network error: Unable to connect to server. Please check your internet connection.'
          : fetchError.message || 'Failed to update document')
      }
      
      if (!res.ok) {
        let errorMessage = 'Failed to update document'
        try {
          const errorData = await res.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = res.statusText || `Server returned ${res.status}`
        }
        throw new Error(errorMessage)
      }
      
      const data = await res.json()
      setDocuments((prev) => prev.map((doc) => (doc.id === data.document.id ? data.document : doc)))
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to save document. Please check your connection and try again.'
      setError(errorMessage)
      console.error('Error saving document:', err)
    } finally {
      setSaving((prev) => ({ ...prev, [requirement.id]: false }))
    }
  }

  const handleUpload = async (requirement: DocumentRequirement, file: File | null) => {
    if (!file) return
    setSaving((prev) => ({ ...prev, [requirement.id]: true }))
    setError(null)
    try {
      const doc = await ensureDocument(requirement.id)
      if (!doc) return
      const ext = file.name.split('.').pop() || 'pdf'
      const bucket = STORAGE_BUCKET_BY_SUBJECT[subjectType]
      const path = `subject-documents/${subjectType}/${subjectId}/${requirement.id}_${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { cacheControl: '3600', upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(path)
      const payload = {
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        file_path: path,
        file_url: publicUrl,
        doc_type: requirement.name,
      }
      const { data: docRow, error: insertError } = await supabase
        .from('documents')
        .insert(payload)
        .select('id')
        .single()
      if (insertError) throw insertError
      if (docRow?.id) {
        await supabase.from('document_subject_document_links').insert({
          document_id: docRow.id,
          subject_document_id: doc.id,
        })
        if (doc.status === 'missing') {
          await supabase.from('subject_documents').update({ status: 'valid' }).eq('id', doc.id)
        }
        const newStatus = doc.status === 'missing' ? 'valid' : doc.status
        setDrafts((prev) => ({
          ...prev,
          [requirement.id]: { ...(prev[requirement.id] || defaultDraft), status: newStatus },
        }))
        setDocuments((prev) =>
          prev.map((sd) =>
            sd.id === doc.id
              ? {
                  ...sd,
                  status: newStatus,
                  document_subject_document_links: [
                    ...(sd.document_subject_document_links || []),
                    {
                      document_id: docRow.id,
                      documents: {
                        id: docRow.id,
                        file_name: file.name,
                        file_url: publicUrl,
                        file_path: path,
                      },
                    },
                  ],
                }
              : sd
          )
        )
        if (subjectType === 'driver') {
          await supabase.from('document_driver_links').insert({
            document_id: docRow.id,
            driver_employee_id: subjectId,
          })
        } else if (subjectType === 'pa') {
          await supabase.from('document_pa_links').insert({
            document_id: docRow.id,
            pa_employee_id: subjectId,
          })
        } else if (subjectType === 'vehicle') {
          await supabase.from('document_vehicle_links').insert({
            document_id: docRow.id,
            vehicle_id: subjectId,
          })
        }
        // employee: document is linked via document_subject_document_links only (subject_document has employee_id)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload document')
    } finally {
      setSaving((prev) => ({ ...prev, [requirement.id]: false }))
    }
  }

  const displayStatus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

  const effectiveStatus = (sd: SubjectDocument | undefined, fallback: string) => {
    const hasLinkedDocs = (sd?.document_subject_document_links?.length ?? 0) > 0
    if (hasLinkedDocs && fallback === 'missing') return 'valid'
    return fallback
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="p-3 border-b bg-slate-50/50 flex justify-between items-center">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Documents & Certificates
          </h3>
          {!loading && requirements.length > 0 && (
            <Button
              variant={isEditing ? 'outline' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setIsEditing((e) => !e)}
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </Button>
          )}
        </div>
        <div className="p-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 border border-rose-100">
              {error}
            </div>
          )}
          {loading ? (
            <div className="text-sm text-slate-500 py-2">Loading checklist…</div>
          ) : requirements.length === 0 ? (
            <div className="text-sm text-slate-500 py-2">No requirements configured.</div>
          ) : (
            <div className="space-y-3">
              {requirements.map((req) => {
                const draft = drafts[req.id] || defaultDraft
                const doc = documentsByRequirement[req.id]
                const display = doc ? { ...defaultDraft, ...draft } : draft

                if (!isEditing) {
                  return (
                    <div
                      key={req.id}
                      className="rounded-lg border border-slate-100 bg-slate-50/30 p-3 space-y-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{req.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                          {req.criticality} · {req.is_required ? 'Required' : 'Optional'}
                        </p>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Status</p>
                          <p className="text-sm text-slate-900 mt-0.5">{displayStatus(effectiveStatus(doc, display.status))}</p>
                        </div>
                        {req.requires_number && (
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Certificate number</p>
                            <p className="text-sm text-slate-900 mt-0.5">{display.certificate_number || '—'}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Issue date</p>
                          <p className="text-sm text-slate-900 mt-0.5">{display.issue_date || '—'}</p>
                        </div>
                        {req.requires_expiry && (
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Expiry date</p>
                            <p className="text-sm text-slate-900 mt-0.5">{display.expiry_date || '—'}</p>
                          </div>
                        )}
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Notes</p>
                          <p className="text-sm text-slate-900 mt-0.5">{display.notes || '—'}</p>
                        </div>
                        {req.requires_upload && (
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Document</p>
                            <LinkedDocumentsDisplay doc={doc} />
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={req.id}
                    className="rounded-lg border border-slate-100 bg-slate-50/30 p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{req.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wide">
                          {req.criticality} · {req.is_required ? 'Required' : 'Optional'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleSave(req)}
                        disabled={!!saving[req.id]}
                      >
                        {saving[req.id] ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-slate-500">Status</Label>
                        <Select
                          value={draft.status}
                          onChange={(e) => updateDraft(req.id, 'status', e.target.value)}
                          className="h-9 text-sm"
                        >
                          <option value="missing">Missing</option>
                          <option value="valid">Valid</option>
                          <option value="pending">Pending</option>
                          <option value="rejected">Rejected</option>
                          <option value="expired">Expired</option>
                        </Select>
                      </div>
                      {req.requires_number && (
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wide text-slate-500">Certificate number</Label>
                          <Input
                            className="h-9 text-sm"
                            value={draft.certificate_number || ''}
                            onChange={(e) => updateDraft(req.id, 'certificate_number', e.target.value)}
                            onFocus={(e) => e.target.select()}
                          />
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-slate-500">Issue date</Label>
                        <Input
                          type="date"
                          className="h-9 text-sm"
                          value={draft.issue_date}
                          onChange={(e) => updateDraft(req.id, 'issue_date', e.target.value)}
                        />
                      </div>
                      {req.requires_expiry && (
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wide text-slate-500">Expiry date</Label>
                          <Input
                            type="date"
                            className="h-9 text-sm"
                            value={draft.expiry_date}
                            onChange={(e) => updateDraft(req.id, 'expiry_date', e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wide text-slate-500">Notes</Label>
                        <Input
                          className="h-9 text-sm"
                          value={draft.notes}
                          onChange={(e) => updateDraft(req.id, 'notes', e.target.value)}
                        />
                      </div>
                      {req.requires_upload && (
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase tracking-wide text-slate-500">Upload document</Label>
                          <Input
                            type="file"
                            className="h-9 text-sm"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleUpload(req, e.target.files?.[0] || null)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default SubjectDocumentsChecklist
