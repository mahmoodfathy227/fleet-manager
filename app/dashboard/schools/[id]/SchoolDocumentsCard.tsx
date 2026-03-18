'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FileText, Upload, X } from 'lucide-react'

interface SchoolDocumentRow {
  id: number
  title: string | null
  notes: string | null
  file_name: string | null
  file_type: string | null
  file_path: string | null
  file_url: string | null
  uploaded_at: string
  uploaded_by: number | null
  users?: {
    email?: string | null
  } | null
}

export default function SchoolDocumentsCard({ schoolId }: { schoolId: number }) {
  const supabase = createClient()
  const [documents, setDocuments] = useState<SchoolDocumentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadDocuments = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('documents')
      .select('id, title, notes, file_name, file_type, file_path, file_url, uploaded_at, uploaded_by, users(email)')
      .eq('owner_type', 'school')
      .eq('owner_id', schoolId)
      .order('uploaded_at', { ascending: false })

    if (error) {
      console.error('Error fetching school documents', error)
      setDocuments([])
    } else {
      setDocuments((data as SchoolDocumentRow[]) || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadDocuments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId])

  const handleUpload = async () => {
    if (!title.trim()) {
      setError('Please enter a title for this document.')
      return
    }
    if (!file) {
      setError('Please choose a file to upload.')
      return
    }
    setError(null)
    setUploading(true)
    try {
      const { data: auth } = await supabase.auth.getUser()
      const authUser = auth?.user
      if (!authUser?.email) {
        throw new Error('You must be signed in to upload documents.')
      }

      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser.email)
        .maybeSingle()

      const uploadedBy = userRow?.id ?? null

      const ext = file.name.split('.').pop() || 'bin'
      const ts = Date.now()
      const rand = Math.random().toString(36).slice(2, 8)
      const storagePath = `schools/${schoolId}/${ts}_${rand}.${ext}`

      const bucket = 'DOCUMENTS'
      const { error: uploadErr } = await supabase.storage
        .from(bucket)
        .upload(storagePath, file, { cacheControl: '3600', upsert: false })
      if (uploadErr) {
        if (uploadErr.message.includes('Bucket not found') || uploadErr.message.includes('not found')) {
          throw new Error(`Storage bucket "${bucket}" not found. Please create a public bucket named "${bucket}" in Supabase Storage.`)
        }
        throw uploadErr
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(storagePath)

      const { error: docErr } = await supabase
        .from('documents')
        .insert({
          owner_type: 'school',
          owner_id: schoolId,
          title: title.trim(),
          notes: notes.trim() || null,
          file_name: file.name,
          file_type: file.type || 'application/octet-stream',
          file_path: storagePath,
          file_url: publicUrl,
          doc_type: null,
          uploaded_by: uploadedBy,
        })

      if (docErr) throw docErr

      setTitle('')
      setNotes('')
      setFile(null)
      setShowUpload(false)
      await loadDocuments()
    } catch (err: any) {
      console.error('Upload failed', err)
      setError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const resolveUrl = (doc: SchoolDocumentRow) => {
    if (!doc.file_url && !doc.file_path) return null
    if (doc.file_url) {
      try {
        const parsed = JSON.parse(doc.file_url)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed[0]
      } catch {
        return doc.file_url
      }
    }
    if (doc.file_path) {
      const { data } = supabase.storage.from('DOCUMENTS').getPublicUrl(doc.file_path)
      return data.publicUrl
    }
    return null
  }

  return (
    <Card>
      <CardHeader className="bg-navy text-white">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>School Documents ({documents.length})</span>
          </CardTitle>
          <Button size="sm" variant="secondary" onClick={() => setShowUpload(!showUpload)}>
            {showUpload ? 'Cancel' : 'Add Document'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {showUpload && (
          <div className="space-y-3 border rounded-lg p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="school-doc-title">Title *</Label>
                <Input
                  id="school-doc-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., SLA, Contract, Policy"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="school-doc-file">File *</Label>
                <Input
                  id="school-doc-file"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="school-doc-notes">Notes (optional)</Label>
              <textarea
                id="school-doc-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md border-slate-300 text-sm focus:border-primary focus:ring-primary"
                placeholder="Any important context or notes about this document..."
              />
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
                  setFile(null)
                  setTitle('')
                  setNotes('')
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
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Title</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Notes</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">File</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Uploaded At</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Uploaded By</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documents.map((doc) => {
                  const url = resolveUrl(doc)
                  const uploadedByEmail = (Array.isArray(doc.users) ? (doc.users[0] as any)?.email : doc.users?.email) || '-'
                  return (
                    <tr key={doc.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">{doc.title || doc.file_name || 'Document'}</td>
                      <td className="px-4 py-2 text-sm text-gray-500 max-w-xs">
                        {doc.notes ? <span className="line-clamp-2">{doc.notes}</span> : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {url ? (
                          <a className="text-blue-600 hover:underline" href={url} target="_blank" rel="noreferrer">
                            {doc.file_name || 'View'}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {new Date(doc.uploaded_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {uploadedByEmail}
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

