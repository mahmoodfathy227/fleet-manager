'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/hooks/usePermissions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FileText, Upload, X, Trash2, RefreshCw, Loader2 } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

interface DocumentRow {
  id: number
  file_name: string | null
  file_type: string | null
  file_path: string | null
  file_url: string | null
  doc_type: string | null
  uploaded_at: string
}

const LINK_TABLES = [
  'document_vehicle_links',
  'document_driver_links',
  'document_pa_links',
  'document_subject_document_links',
] as const

async function countDocumentLinks(supabase: ReturnType<typeof createClient>, documentId: number): Promise<number> {
  let total = 0
  for (const table of LINK_TABLES) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('document_id', documentId)
    if (error) throw error
    total += count ?? 0
  }
  return total
}

export default function VehicleDocuments({ vehicleId }: { vehicleId: number }) {
  const supabase = createClient()
  const { has } = usePermissions()
  const canWrite = has('vehicle_documents.write')
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [replacingDocId, setReplacingDocId] = useState<number | null>(null)
  const [replaceBusyDocId, setReplaceBusyDocId] = useState<number | null>(null)
  const [deletingDocId, setDeletingDocId] = useState<number | null>(null)

  const loadDocuments = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('document_vehicle_links')
      .select('documents (id, file_name, file_type, file_path, file_url, doc_type, uploaded_at)')
      .eq('vehicle_id', vehicleId)

    if (error) {
      console.error('Error fetching vehicle documents', error)
      setDocuments([])
    } else {
      const docs = (data || [])
        .map((row: any) => row.documents)
        .filter(Boolean)
        .sort((a: any, b: any) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())
      setDocuments(docs || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadDocuments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicleId])

  /** View URL on our domain; requires auth. Only when file_path is set. */
  const getDocumentViewUrl = (path: string | null) => {
    if (!path || path.includes('..')) return null
    return `/api/documents/view?bucket=VEHICLE_DOCUMENTS&path=${encodeURIComponent(path)}`
  }

  const handleUpload = async () => {
    if (!files || files.length === 0) {
      setError('Please select at least one file.')
      return
    }
    setError(null)
    setUploading(true)
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const ext = file.name.split('.').pop() || 'bin'
        const ts = Date.now()
        const rand = Math.random().toString(36).slice(2, 8)
        const storagePath = `vehicles/${vehicleId}/${ts}_${rand}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from('VEHICLE_DOCUMENTS')
          .upload(storagePath, file, { cacheControl: '3600', upsert: false })
        if (uploadErr) throw uploadErr

        const { data: { publicUrl } } = supabase.storage
          .from('VEHICLE_DOCUMENTS')
          .getPublicUrl(storagePath)

        const { data: docRow, error: docErr } = await supabase.from('documents').insert({
          file_name: file.name,
          file_type: file.type,
          file_path: storagePath,
          file_url: publicUrl,
          doc_type: docType || null,
          uploaded_by: null,
        }).select('id').single()
        if (docErr) throw docErr
        if (docRow?.id) {
          const { error: linkErr } = await supabase.from('document_vehicle_links').insert({
            document_id: docRow.id,
            vehicle_id: vehicleId,
          })
          if (linkErr) throw linkErr
        }
      }
      setFiles(null)
      setDocType('')
      setShowUpload(false)
      loadDocuments()
    } catch (err: any) {
      console.error('Upload failed', err)
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const removeStorageObject = async (path: string | null) => {
    if (!path || path.includes('..')) return
    const { error: rmErr } = await supabase.storage.from('VEHICLE_DOCUMENTS').remove([path])
    if (rmErr) console.warn('[fleet] VehicleDocuments: storage remove', path, rmErr)
  }

  const handleDeleteDocument = async (doc: DocumentRow) => {
    if (!canWrite) return
    if (!window.confirm(`Remove “${doc.file_name || 'this file'}” from this vehicle?`)) return
    setError(null)
    setDeletingDocId(doc.id)
    console.debug('[fleet] VehicleDocuments: delete start', { documentId: doc.id, vehicleId })
    try {
      const { error: linkErr } = await supabase
        .from('document_vehicle_links')
        .delete()
        .eq('document_id', doc.id)
        .eq('vehicle_id', vehicleId)
      if (linkErr) throw linkErr

      const remaining = await countDocumentLinks(supabase, doc.id)
      if (remaining === 0) {
        await removeStorageObject(doc.file_path)
        const { error: delErr } = await supabase.from('documents').delete().eq('id', doc.id)
        if (delErr) throw delErr
      }
      console.debug('[fleet] VehicleDocuments: delete done', { documentId: doc.id, remainingLinks: remaining })
      await loadDocuments()
    } catch (err: any) {
      console.error('[fleet] VehicleDocuments: delete failed', err)
      setError(err.message || 'Delete failed')
    } finally {
      setDeletingDocId(null)
    }
  }

  const handleReplacePick = (docId: number) => {
    setReplacingDocId(docId)
    replaceInputRef.current?.click()
  }

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || replacingDocId === null || !canWrite) {
      setReplacingDocId(null)
      return
    }
    const doc = documents.find((d) => d.id === replacingDocId)
    setReplacingDocId(null)
    if (!doc) return

    setError(null)
    setReplaceBusyDocId(doc.id)
    console.debug('[fleet] VehicleDocuments: replace start', { documentId: doc.id, vehicleId })
    try {
      const ext = file.name.split('.').pop() || 'bin'
      const ts = Date.now()
      const rand = Math.random().toString(36).slice(2, 8)
      const storagePath = `vehicles/${vehicleId}/${ts}_${rand}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('VEHICLE_DOCUMENTS')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false })
      if (uploadErr) throw uploadErr

      const { data: pub } = supabase.storage.from('VEHICLE_DOCUMENTS').getPublicUrl(storagePath)
      const publicUrl = pub.publicUrl

      const { error: updErr } = await supabase
        .from('documents')
        .update({
          file_name: file.name,
          file_type: file.type,
          file_path: storagePath,
          file_url: publicUrl,
          uploaded_at: new Date().toISOString(),
        })
        .eq('id', doc.id)
      if (updErr) {
        await supabase.storage.from('VEHICLE_DOCUMENTS').remove([storagePath])
        throw updErr
      }

      await removeStorageObject(doc.file_path)
      console.debug('[fleet] VehicleDocuments: replace done', { documentId: doc.id })
      await loadDocuments()
    } catch (err: any) {
      console.error('[fleet] VehicleDocuments: replace failed', err)
      setError(err.message || 'Replace failed')
    } finally {
      setReplaceBusyDocId(null)
    }
  }

  return (
    <Card>
      <CardHeader className="bg-navy text-white">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Vehicle Documents ({documents.length})</span>
          </CardTitle>
          <Button size="sm" variant="secondary" onClick={() => setShowUpload(!showUpload)} disabled={!canWrite}>
            {showUpload ? 'Cancel' : 'Upload Document'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {!canWrite && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            You need <code className="text-xs">vehicle_documents.write</code> to upload, replace, or delete files.
          </p>
        )}

        {showUpload && (
          <div className="space-y-3 border rounded-lg p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="docType">Document Type (optional)</Label>
                <Input
                  id="docType"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  placeholder="e.g., Insurance, MOT, Contract"
                />
              </div>
              <div className="space-y-1">
                <Label>Files</Label>
                <Input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={(e) => setFiles(e.target.files)}
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex space-x-2">
              <Button onClick={handleUpload} disabled={uploading || !canWrite}>
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowUpload(false)
                  setError(null)
                  setFiles(null)
                  setDocType('')
                }}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-sm text-gray-600">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-600">No documents uploaded yet.</div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <input
              ref={replaceInputRef}
              type="file"
              className="hidden"
              accept="image/*,application/pdf"
              onChange={handleReplaceFile}
            />
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Uploaded</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Doc Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Link</th>
                  {canWrite ? (
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-[1%]">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documents.map((doc) => {
                  const url = getDocumentViewUrl(doc.file_path)
                  const busy = deletingDocId === doc.id || replaceBusyDocId === doc.id
                  return (
                    <tr key={doc.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">{doc.file_name || 'File'}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{doc.file_type || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {formatDateTime(doc.uploaded_at)}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">{doc.doc_type || '-'}</td>
                      <td className="px-4 py-2 text-sm">
                        {url ? (
                          <a
                            className="text-blue-600 hover:underline"
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                      {canWrite ? (
                        <td className="px-4 py-2 text-sm whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 px-2"
                              disabled={busy}
                              onClick={() => handleReplacePick(doc.id)}
                              title="Replace file"
                            >
                              {replaceBusyDocId === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-red-700 border-red-200 hover:bg-red-50"
                              disabled={busy}
                              onClick={() => handleDeleteDocument(doc)}
                              title="Remove from vehicle"
                            >
                              {deletingDocId === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

