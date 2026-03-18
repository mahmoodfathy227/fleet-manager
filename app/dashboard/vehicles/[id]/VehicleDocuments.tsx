'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FileText, Upload, X } from 'lucide-react'

interface DocumentRow {
  id: number
  file_name: string | null
  file_type: string | null
  file_path: string | null
  file_url: string | null
  doc_type: string | null
  uploaded_at: string
}

export default function VehicleDocuments({ vehicleId }: { vehicleId: number }) {
  const supabase = createClient()
  const [documents, setDocuments] = useState<DocumentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <Card>
      <CardHeader className="bg-navy text-white">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Vehicle Documents ({documents.length})</span>
          </CardTitle>
          <Button size="sm" variant="secondary" onClick={() => setShowUpload(!showUpload)}>
            {showUpload ? 'Cancel' : 'Upload Document'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
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
              <Button onClick={handleUpload} disabled={uploading}>
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
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Uploaded</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Doc Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Link</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documents.map((doc) => {
                  const url = getDocumentViewUrl(doc.file_path)
                  return (
                    <tr key={doc.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">{doc.file_name || 'File'}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">{doc.file_type || '-'}</td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {new Date(doc.uploaded_at).toLocaleString()}
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

