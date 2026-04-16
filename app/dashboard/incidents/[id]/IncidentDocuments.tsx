'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FileText, ExternalLink, Download, X } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

/** TR5 stores files as data URLs; opening them via `href` often hits URL length limits → blank tab. */
function dataUrlToBlob(dataUrl: string): Blob {
  const commaIdx = dataUrl.indexOf(',')
  if (commaIdx === -1) throw new Error('Invalid data URL')
  const meta = dataUrl.slice(0, commaIdx)
  const raw = dataUrl.slice(commaIdx + 1).replace(/\s/g, '')
  const mimeMatch = meta.match(/^data:([^;,]+)/)
  const mimeType = mimeMatch?.[1] ?? 'application/octet-stream'
  const isBase64 = /;base64/i.test(meta)
  if (isBase64) {
    const binary = atob(raw)
    const len = binary.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: mimeType })
  }
  return new Blob([decodeURIComponent(raw)], { type: mimeType })
}

/** Files the user attached in the TR5 form (stored inside the TR5 Form JSON row). */
export type Tr5UploadedDoc = {
  id: string
  fileName: string
  mimeType: string
  dataUrl: string
  tr5SavedAt: string
  savedByEmail?: string
}

interface IncidentDocumentsProps {
  incidentId: number
}

function parseTr5PhotoAttachments(
  fileUrl: string | null,
  meta: { uploaded_at: string; savedByEmail?: string }
): Tr5UploadedDoc[] {
  if (!fileUrl?.trim()) return []
  try {
    const parsed = JSON.parse(fileUrl) as { photoAttachments?: unknown }
    const raw = parsed.photoAttachments
    if (!Array.isArray(raw)) return []
    const out: Tr5UploadedDoc[] = []
    for (const item of raw) {
      if (
        item &&
        typeof item === 'object' &&
        'id' in item &&
        'fileName' in item &&
        'mimeType' in item &&
        'dataUrl' in item &&
        typeof (item as { dataUrl: unknown }).dataUrl === 'string' &&
        String((item as { dataUrl: string }).dataUrl).startsWith('data:')
      ) {
        const a = item as { id: string; fileName: string; mimeType: string; dataUrl: string }
        out.push({
          id: a.id,
          fileName: a.fileName,
          mimeType: a.mimeType,
          dataUrl: a.dataUrl,
          tr5SavedAt: meta.uploaded_at,
          savedByEmail: meta.savedByEmail,
        })
      }
    }
    return out
  } catch {
    return []
  }
}

type PreviewState = { blobUrl: string; fileName: string; mimeType: string }

export default function IncidentDocuments({ incidentId }: IncidentDocumentsProps) {
  const supabase = createClient()
  const [attachments, setAttachments] = useState<Tr5UploadedDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [viewError, setViewError] = useState<string | null>(null)
  const previewBlobUrlRef = useRef<string | null>(null)
  previewBlobUrlRef.current = preview?.blobUrl ?? null

  useEffect(() => {
    return () => {
      if (previewBlobUrlRef.current) {
        URL.revokeObjectURL(previewBlobUrlRef.current)
        previewBlobUrlRef.current = null
      }
    }
  }, [])

  const closePreview = useCallback(() => {
    setPreview((p) => {
      if (p?.blobUrl) URL.revokeObjectURL(p.blobUrl)
      return null
    })
  }, [])

  useEffect(() => {
    loadTr5UploadedDocuments()
  }, [incidentId])

  const loadTr5UploadedDocuments = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('documents')
      .select(
        `
        file_url,
        uploaded_at,
        users (
          email
        )
      `
      )
      .eq('owner_type', 'incident')
      .eq('owner_id', incidentId)
      .eq('doc_type', 'TR5 Form')
      .order('uploaded_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Error loading TR5 form for documents:', error)
      setAttachments([])
    } else {
      const row = data?.[0]
      const usersRel = row?.users as { email: string } | { email: string }[] | null | undefined
      const savedByEmail = Array.isArray(usersRel) ? usersRel[0]?.email : usersRel?.email
      const list = row
        ? parseTr5PhotoAttachments(row.file_url, {
            uploaded_at: row.uploaded_at,
            savedByEmail,
          })
        : []
      setAttachments(list)
      console.debug('[IncidentDocuments] TR5-only attachments', {
        incidentId,
        count: list.length,
      })
    }
    setLoading(false)
  }

  const openAttachment = (att: Tr5UploadedDoc) => {
    setViewError(null)
    try {
      const blob = dataUrlToBlob(att.dataUrl)
      const blobUrl = URL.createObjectURL(blob)
      const win = window.open(blobUrl, '_blank', 'noopener,noreferrer')
      console.debug('[IncidentDocuments] View TR5 attachment', {
        fileName: att.fileName,
        blobSize: blob.size,
        openedNewTab: !!win,
      })
      if (win) {
        setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000)
        return
      }
      URL.revokeObjectURL(blobUrl)
      const blobUrl2 = URL.createObjectURL(blob)
      setPreview((prev) => {
        if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl)
        return { blobUrl: blobUrl2, fileName: att.fileName, mimeType: att.mimeType || blob.type }
      })
      console.debug('[IncidentDocuments] popup blocked or window.open failed — inline preview', att.fileName)
    } catch (e) {
      console.error('[IncidentDocuments] TR5 view/decode failed', e)
      setViewError('Could not open this file. It may be corrupted or too large to decode.')
    }
  }

  const downloadAttachment = (att: Tr5UploadedDoc) => {
    setViewError(null)
    try {
      const blob = dataUrlToBlob(att.dataUrl)
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = att.fileName || 'attachment'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000)
      console.debug('[IncidentDocuments] Download TR5 attachment', att.fileName)
    } catch (e) {
      console.error('[IncidentDocuments] TR5 download failed', e)
      setViewError('Could not prepare download for this file.')
    }
  }

  return (
    <Card>
      <CardHeader className="bg-navy text-white">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <FileText className="mr-2 h-5 w-5" />
            Incident Documents — TR5 uploads ({attachments.length})
          </CardTitle>
        </div>
        <p className="text-xs text-white/80 mt-2 font-normal">
          Only files attached in the TR5 form (Photos section) are listed here. Generic incident uploads and
          TR6/TR7 records are not shown.
        </p>
      </CardHeader>
      <CardContent className="pt-6">
        {viewError && (
          <p className="text-sm text-red-600 mb-4" role="alert">
            {viewError}
          </p>
        )}
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div>
            <p className="mt-2 text-sm text-gray-500">Loading TR5 attachments...</p>
          </div>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-gray-500 italic">
            No files attached in the TR5 form for this incident. Open the TR5 tab, set &quot;Photos attached?&quot;
            to Yes, add files, and save the form.
          </p>
        ) : (
          <div className="space-y-3">
            {attachments.map((att) => (
              <div key={att.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                      <h4 className="text-sm font-semibold text-gray-900 truncate">{att.fileName}</h4>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">
                      TR5 form saved: {formatDateTime(att.tr5SavedAt)}
                      {att.savedByEmail && ` by ${att.savedByEmail}`}
                    </p>
                    <p className="text-xs text-gray-500">Type: {att.mimeType || 'N/A'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0 ml-2 justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-8 text-xs bg-navy text-white hover:bg-blue-800 border-0"
                      onClick={() => openAttachment(att)}
                      title="Opens in a new tab using a short-lived preview URL (avoids blank page from huge data links)"
                    >
                      <ExternalLink className="mr-1 h-3 w-3" />
                      View
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      onClick={() => downloadAttachment(att)}
                      title="Save a copy to your device"
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Download
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {preview && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Attachment preview"
          onClick={closePreview}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
              <span className="text-sm font-medium text-slate-800 truncate pr-2">{preview.fileName}</span>
              <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={closePreview}>
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
            <div className="max-h-[calc(90vh-3rem)] overflow-auto bg-slate-50 p-2">
              {preview.mimeType.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.blobUrl} alt={preview.fileName} className="mx-auto max-h-[80vh] max-w-full object-contain" />
              ) : (
                <iframe title={preview.fileName} src={preview.blobUrl} className="h-[80vh] w-full rounded border-0 bg-white" />
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

