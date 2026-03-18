'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FileText, Upload, ExternalLink } from 'lucide-react'

interface LogbookDoc {
  id: number
  file_name: string | null
  file_type: string | null
  file_path: string | null
  file_url: string | null
  uploaded_at: string
}

export default function VehicleLogbook({ vehicleId }: { vehicleId: number }) {
  const supabase = createClient()
  const [docs, setDocs] = useState<LogbookDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadLogbooks = async () => {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('document_vehicle_links')
      .select('documents (id, file_name, file_type, file_path, file_url, doc_type, uploaded_at)')
      .eq('vehicle_id', vehicleId)

    if (fetchError) {
      setDocs([])
      setLoading(false)
      return
    }

    const logbooks = (data || [])
      .map((row: any) => row.documents)
      .filter(Boolean)
      .filter((d: any) => (d.doc_type || '').toLowerCase() === 'logbook')
      .sort((a: any, b: any) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())

    setDocs(logbooks)
    setLoading(false)
  }

  useEffect(() => {
    loadLogbooks()
  }, [vehicleId])

  /** View URL on our domain; requires auth. Only when file_path is set. */
  const getDocumentViewUrl = (path: string | null) => {
    if (!path || path.includes('..')) return null
    return `/api/documents/view?bucket=VEHICLE_DOCUMENTS&path=${encodeURIComponent(path)}`
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file.')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'pdf'
      const storagePath = `vehicles/${vehicleId}/logbook_${Date.now()}.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('VEHICLE_DOCUMENTS')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false })
      if (uploadErr) throw uploadErr

      const { data: { publicUrl } } = supabase.storage
        .from('VEHICLE_DOCUMENTS')
        .getPublicUrl(storagePath)

      const { data: docRow, error: docErr } = await supabase.from('documents').insert({
        file_name: file.name,
        file_type: file.type || 'application/pdf',
        file_path: storagePath,
        file_url: publicUrl,
        doc_type: 'Logbook',
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
      setFile(null)
      loadLogbooks()
    } catch (err: any) {
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="bg-slate-50 border-b border-slate-200">
        <CardTitle className="text-slate-900 text-base font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-slate-600" />
          Vehicle Logbook
        </CardTitle>
        <p className="text-xs text-slate-500 mt-1">Upload and view the vehicle logbook (usually a PDF).</p>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <div className="flex-1 w-full">
            <Label htmlFor="logbook_upload" className="text-sm text-slate-700">Upload logbook (PDF preferred)</Label>
            <Input
              id="logbook_upload"
              type="file"
              accept=".pdf,application/pdf,.jpg,.jpeg,.png,image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-1 text-sm file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:text-sm file:bg-slate-100 file:text-slate-700"
            />
          </div>
          <Button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="shrink-0"
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}

        {loading ? (
          <p className="text-sm text-slate-500 py-2">Loading logbook...</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-slate-500 py-2">No logbook uploaded yet. Upload a PDF above.</p>
        ) : (
          <ul className="space-y-2 border rounded-lg divide-y divide-slate-100">
            {docs.map((doc) => {
              const url = getDocumentViewUrl(doc.file_path)
              return (
                <li key={doc.id} className="flex items-center justify-between p-3 hover:bg-slate-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="text-sm font-medium text-slate-900 truncate">{doc.file_name || 'Logbook'}</span>
                    <span className="text-xs text-slate-400 shrink-0">
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </span>
                  </div>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1 shrink-0"
                    >
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
