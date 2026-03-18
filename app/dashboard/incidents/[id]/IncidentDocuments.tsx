'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { FileText, ExternalLink, Download, Eye } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import UploadIncidentDocument from './UploadIncidentDocument'

interface Document {
  id: number
  file_name: string | null
  file_url: string | null
  file_type: string | null
  file_path: string | null
  uploaded_at: string
  uploaded_by: number | null
  users?: {
    email: string
  }
}

interface IncidentDocumentsProps {
  incidentId: number
}

export default function IncidentDocuments({ incidentId }: IncidentDocumentsProps) {
  const supabase = createClient()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)

  useEffect(() => {
    loadDocuments()
  }, [incidentId])

  const loadDocuments = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        users (
          email
        )
      `)
      .eq('owner_type', 'incident')
      .eq('owner_id', incidentId)
      .order('uploaded_at', { ascending: false })

    if (error) {
      console.error('Error loading documents:', error)
    } else {
      setDocuments(data || [])
    }
    setLoading(false)
  }

  const parseFileUrls = (fileUrl: string | null): string[] => {
    if (!fileUrl) return []
    try {
      const parsed = JSON.parse(fileUrl)
      return Array.isArray(parsed) ? parsed : [fileUrl]
    } catch {
      return [fileUrl]
    }
  }

  return (
    <Card>
      <CardHeader className="bg-navy text-white">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <FileText className="mr-2 h-5 w-5" />
            Incident Documents ({documents.length})
          </CardTitle>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowUpload(!showUpload)}
            className="bg-white text-navy hover:bg-gray-100"
          >
            {showUpload ? 'Cancel' : 'Upload Document'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {showUpload && (
          <div className="mb-6">
            <UploadIncidentDocument
              incidentId={incidentId}
              onSuccess={() => {
                setShowUpload(false)
                loadDocuments()
              }}
            />
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div>
            <p className="mt-2 text-sm text-gray-500">Loading documents...</p>
          </div>
        ) : documents.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No documents uploaded for this incident.</p>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => {
              const fileUrls = parseFileUrls(doc.file_url || doc.file_path)
              return (
                <div key={doc.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <h4 className="text-sm font-semibold text-gray-900">
                          {doc.file_name || 'Untitled Document'}
                        </h4>
                        {fileUrls.length > 1 && (
                          <span className="text-xs text-gray-500">
                            ({fileUrls.length} files)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mb-2">
                        Uploaded: {formatDateTime(doc.uploaded_at)}
                        {doc.users && ` by ${doc.users.email}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        Type: {doc.file_type || 'N/A'}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      {fileUrls.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded px-2 py-1 text-xs font-medium bg-navy text-white hover:bg-blue-800 transition-colors"
                          title={`View ${fileUrls.length > 1 ? `file ${idx + 1}` : 'document'}`}
                        >
                          {fileUrls.length > 1 ? (
                            <>
                              <Eye className="mr-1 h-3 w-3" />
                              View {idx + 1}
                            </>
                          ) : (
                            <>
                              <ExternalLink className="mr-1 h-3 w-3" />
                              View
                            </>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

