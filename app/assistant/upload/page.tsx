'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { Upload, CheckCircle, XCircle, FileText, Image as ImageIcon, Loader2, Eye, Download, Wrench } from 'lucide-react'
import { uploadAssistantDocument } from '@/lib/supabase/assistantDocuments'
import { formatDate, formatDateTime } from '@/lib/utils'

function AssistantUploadContent() {
  const searchParams = useSearchParams()
  const token = searchParams?.get('token') ?? null
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [assistantInfo, setAssistantInfo] = useState<{
    id: number
    name: string
    routeName: string | null
    employeeId: number | null
  } | null>(null)
  const [activeSessions, setActiveSessions] = useState<Array<{
    id: number
    session_date: string
    session_type: string
    started_at: string
    route_name: string | null
  }>>([])
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [filePreviews, setFilePreviews] = useState<Record<string, string>>({})
  const [docType, setDocType] = useState<string>('')
  const [uploadedDocuments, setUploadedDocuments] = useState<Array<{
    id: number
    doc_type: string
    file_name: string
    file_url: string
    uploaded_at: string
    file_count?: number
  }>>([])
  const [loadingDocuments, setLoadingDocuments] = useState(false)
  const [uploadResult, setUploadResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [reportingBreakdown, setReportingBreakdown] = useState(false)
  const [breakdownReported, setBreakdownReported] = useState<number | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (token) {
      loadAssistantInfo()
    } else {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (assistantInfo?.employeeId) {
      loadActiveSessions(assistantInfo.employeeId)
    }
  }, [assistantInfo?.employeeId])

  useEffect(() => {
    if (selectedSessionId) {
      loadUploadedDocuments(selectedSessionId)
    } else {
      setUploadedDocuments([])
    }
  }, [selectedSessionId])

  const loadAssistantInfo = async () => {
    if (!token) return

    setLoading(true)
    const { data, error } = await supabase
      .from('passenger_assistants')
      .select(`
        id,
        employee_id,
        employees(full_name)
      `)
      .eq('qr_token', token)
      .single()

    if (!error && data) {
      const employee = Array.isArray(data.employees) ? data.employees[0] : data.employees
      
      // Get route information directly from routes table
      let routeName: string | null = null
      if (data.employee_id) {
        const { data: routeData } = await supabase
          .from('routes')
          .select('route_number')
          .eq('passenger_assistant_id', data.employee_id)
          .limit(1)
          .maybeSingle()
        
        if (routeData) {
          routeName = routeData.route_number || null
        }
      }
      
      setAssistantInfo({
        id: data.id,
        name: employee?.full_name || 'Unknown Assistant',
        routeName: routeName,
        employeeId: data.employee_id,
      })
    }
    setLoading(false)
  }

  const loadActiveSessions = async (employeeId: number) => {
    const { data, error } = await supabase
      .from('route_sessions')
      .select(`
        id,
        session_date,
        session_type,
        started_at,
        routes(route_number)
      `)
      .eq('passenger_assistant_id', employeeId)
      .is('ended_at', null)
      .not('started_at', 'is', null)
      .order('session_date', { ascending: false })
      .order('session_type', { ascending: true })

    if (!error && data) {
      setActiveSessions(data.map((s: any) => ({
        id: s.id,
        session_date: s.session_date,
        session_type: s.session_type,
        started_at: s.started_at,
        route_name: s.routes?.route_number || null,
      })))
    }
  }

  const loadUploadedDocuments = async (sessionId: number) => {
    setLoadingDocuments(true)
    const { data, error } = await supabase
      .from('documents')
      .select('id, doc_type, file_name, file_url, uploaded_at')
      .eq('route_session_id', sessionId)
      .eq('owner_type', 'passenger_assistant')
      .order('uploaded_at', { ascending: false })

    if (!error && data) {
      // Parse file_url if it's a JSON array
      const documents = data.map((doc: any) => {
        let fileUrls: string[] = []
        try {
          const parsed = JSON.parse(doc.file_url)
          fileUrls = Array.isArray(parsed) ? parsed : [doc.file_url]
        } catch {
          fileUrls = [doc.file_url]
        }
        return {
          id: doc.id,
          doc_type: doc.doc_type,
          file_name: doc.file_name,
          file_url: doc.file_url,
          uploaded_at: doc.uploaded_at,
          file_count: fileUrls.length,
        }
      })
      setUploadedDocuments(documents)
    }
    setLoadingDocuments(false)
  }

  const handleReportBreakdown = async (sessionId: number) => {
    if (!confirm('Report vehicle breakdown? This will create an urgent notification for administrators.')) {
      return
    }

    setReportingBreakdown(true)
    try {
      const { data, error } = await supabase.rpc('report_vehicle_breakdown', {
        p_route_session_id: sessionId,
        p_description: 'Vehicle breakdown reported via PA QR code',
        p_location: null
      })

      if (error) {
        alert('Error reporting breakdown: ' + error.message)
      } else {
        setBreakdownReported(sessionId)
        alert('Breakdown reported successfully! Administrators have been notified.')
      }
    } catch (err: any) {
      alert('Error: ' + (err.message || 'Failed to report breakdown'))
    } finally {
      setReportingBreakdown(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf']
    const maxSize = 10 * 1024 * 1024 // 10 MB

    const validFiles: File[] = []
    const invalidFiles: string[] = []

    files.forEach((file) => {
      if (!allowedTypes.includes(file.type)) {
        invalidFiles.push(`${file.name}: Invalid file type`)
      } else if (file.size > maxSize) {
        invalidFiles.push(`${file.name}: File size exceeds 10 MB`)
      } else {
        validFiles.push(file)
      }
    })

    if (invalidFiles.length > 0) {
      setUploadResult({
        success: false,
        message: `Some files were rejected:\n${invalidFiles.join('\n')}`,
      })
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles])
      setUploadResult(null)

      // Create previews for images
      validFiles.forEach((file) => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader()
          reader.onloadend = () => {
            setFilePreviews(prev => ({
              ...prev,
              [file.name]: reader.result as string
            }))
          }
          reader.readAsDataURL(file)
        }
      })
    }
  }

  const removeFile = (index: number) => {
    const fileToRemove = selectedFiles[index]
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    
    // Remove preview for this file
    if (fileToRemove) {
      setFilePreviews(prev => {
        const newPreviews = { ...prev }
        delete newPreviews[fileToRemove.name]
        return newPreviews
      })
    }
  }

  const handleUpload = async () => {
    if (!token || selectedFiles.length === 0 || !docType) {
      setUploadResult({
        success: false,
        message: 'Please select at least one file and document type.',
      })
      return
    }

    if (!selectedSessionId) {
      setUploadResult({
        success: false,
        message: 'Please select a route session.',
      })
      return
    }

    setUploading(true)
    setUploadResult(null)

    const result = await uploadAssistantDocument(token, selectedFiles, docType, selectedSessionId)

    setUploading(false)

    if (result.success) {
      setUploadResult({
        success: true,
        message: `Successfully uploaded ${selectedFiles.length} file(s) for ${docType}!`,
      })
      // Reset form
      setSelectedFiles([])
      setDocType('')
      setFilePreviews({})
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      // Reload uploaded documents
      if (selectedSessionId) {
        await loadUploadedDocuments(selectedSessionId)
      }
      // Clear result after 5 seconds
      setTimeout(() => setUploadResult(null), 5000)
    } else {
      setUploadResult({
        success: false,
        message: result.error || 'Upload failed. Please try again.',
      })
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="bg-red-600 text-white">
            <CardTitle className="text-white">Invalid QR Code</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-center text-gray-600">
              The QR code is invalid or missing. Please scan a valid passenger assistant QR code.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="bg-blue-900 text-white">
          <CardTitle className="text-white flex items-center">
            <Upload className="mr-2 h-5 w-5" />
            Upload Document
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {assistantInfo ? (
            <>
              <div className="text-center space-y-2">
                <p className="text-sm text-gray-600">Passenger Assistant</p>
                <p className="text-lg font-semibold text-gray-900">{assistantInfo.name}</p>
                {assistantInfo.routeName && (
                  <>
                    <p className="text-sm text-gray-600 mt-2">Assigned Route</p>
                    <p className="text-lg font-semibold text-blue-900">{assistantInfo.routeName}</p>
                  </>
                )}
              </div>

              {/* Active Sessions Selection */}
              {activeSessions.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="session" className="text-gray-700">
                    Select Route Session *
                  </Label>
                  <Select
                    id="session"
                    value={selectedSessionId || ''}
                    onChange={(e) => setSelectedSessionId(e.target.value ? parseInt(e.target.value) : null)}
                  >
                    <option value="">Select a session...</option>
                    {activeSessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {formatDate(session.session_date)} - {session.session_type} 
                        {session.route_name ? ` (Route: ${session.route_name})` : ''}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-gray-500">
                    Documents will be linked to the selected session
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-900">
                    No active sessions found. Please start a route session first before uploading documents.
                  </p>
                </div>
              )}

              {/* Breakdown Reporting */}
              {activeSessions.length > 0 && (
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Wrench className="h-5 w-5 text-red-600" />
                      <h3 className="font-semibold text-red-900">Vehicle Breakdown</h3>
                    </div>
                  </div>
                  <p className="text-sm text-red-800 mb-3">
                    Report a vehicle breakdown for any active session. This will create an urgent notification.
                  </p>
                  <div className="space-y-2">
                    {activeSessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-2 bg-white rounded border border-red-200"
                      >
                        <div className="text-sm">
                          <span className="font-medium">{formatDate(session.session_date)} - {session.session_type}</span>
                          {session.route_name && (
                            <span className="text-gray-600 ml-2">({session.route_name})</span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleReportBreakdown(session.id)}
                          disabled={reportingBreakdown || breakdownReported === session.id}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          <Wrench className="mr-2 h-4 w-4" />
                          {breakdownReported === session.id ? 'Reported' : 'Report Breakdown'}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Already Uploaded Documents */}
              {selectedSessionId && (
                <div className="space-y-2">
                  <Label className="text-gray-700">
                    Uploaded Documents
                  </Label>
                  {loadingDocuments ? (
                    <div className="text-center py-4">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-900"></div>
                      <p className="mt-2 text-sm text-gray-600">Loading documents...</p>
                    </div>
                  ) : uploadedDocuments.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-2 bg-gray-50">
                      {uploadedDocuments.map((doc) => {
                        let fileUrls: string[] = []
                        try {
                          const parsed = JSON.parse(doc.file_url)
                          fileUrls = Array.isArray(parsed) ? parsed : [doc.file_url]
                        } catch {
                          fileUrls = [doc.file_url]
                        }
                        return (
                          <div
                            key={doc.id}
                            className="p-3 bg-white rounded-lg border border-gray-200"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                                    {doc.doc_type}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {formatDate(doc.uploaded_at)}
                                  </span>
                                </div>
                                <p className="text-sm font-medium text-gray-900 mt-1 truncate">
                                  {doc.file_name}
                                </p>
                                {doc.file_count && doc.file_count > 1 && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {doc.file_count} files
                                  </p>
                                )}
                              </div>
                              <div className="flex space-x-1 ml-2">
                                {fileUrls.map((url, idx) => (
                                  <a
                                    key={idx}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 text-blue-600 hover:text-blue-800"
                                    title="View file"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center">
                      <p className="text-sm text-gray-500">No documents uploaded yet for this session.</p>
                    </div>
                  )}
                </div>
              )}

              {uploadResult ? (
                <div className={`p-4 rounded-lg ${
                  uploadResult.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-start space-x-3">
                    {uploadResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`font-medium ${
                        uploadResult.success ? 'text-green-900' : 'text-red-900'
                      }`}>
                        {uploadResult.message}
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full mt-4"
                    onClick={() => {
                      setUploadResult(null)
                      setSelectedFiles([])
                      setDocType('')
                      setFilePreviews({})
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                      }
                    }}
                  >
                    Upload Another Document
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-center text-gray-600 text-sm">
                    Select document type and files to upload:
                  </p>

                  {/* Document Type Selection */}
                  <div>
                    <Label htmlFor="doc_type" className="text-gray-700">
                      Document Type
                    </Label>
                    <Select
                      id="doc_type"
                      value={docType}
                      onChange={(e) => setDocType(e.target.value)}
                      className="mt-1"
                    >
                      <option value="">Select document type...</option>
                      <option value="TR1">TR1</option>
                      <option value="TR2">TR2</option>
                      <option value="TR3">TR3</option>
                      <option value="TR4">TR4</option>
                      <option value="TR5">TR5</option>
                      <option value="TR6">TR6</option>
                    </Select>
                  </div>

                  {/* File Selection */}
                  <div>
                    <Label htmlFor="file" className="text-gray-700">
                      Select Files (Multiple files allowed)
                    </Label>
                    <div className="mt-1">
                      <Input
                        id="file"
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        multiple
                        onChange={handleFileChange}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Accepted: Images (JPEG, PNG, GIF) and PDF files. Max size per file: 10 MB
                      </p>
                    </div>
                  </div>

                  {/* Selected Files List */}
                  {selectedFiles.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-gray-700">
                        Selected Files ({selectedFiles.length})
                      </Label>
                      <div className="space-y-2 max-h-64 overflow-y-auto border rounded-md p-2 bg-gray-50">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="p-3 bg-white rounded-lg border border-gray-200 flex items-start space-x-3"
                          >
                            {filePreviews[file.name] ? (
                              <img
                                src={filePreviews[file.name]}
                                alt={`Preview ${index + 1}`}
                                className="w-16 h-16 object-cover rounded flex-shrink-0"
                              />
                            ) : file.type === 'application/pdf' ? (
                              <FileText className="h-8 w-8 text-gray-400 flex-shrink-0 mt-1" />
                            ) : (
                              <ImageIcon className="h-8 w-8 text-gray-400 flex-shrink-0 mt-1" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-900 font-medium truncate">{file.name}</p>
                              <p className="text-sm text-gray-500">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                            <button
                              onClick={() => removeFile(index)}
                              className="text-red-600 hover:text-red-700 flex-shrink-0"
                              type="button"
                            >
                              <XCircle className="h-5 w-5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upload Button */}
                  <Button
                    onClick={handleUpload}
                    disabled={selectedFiles.length === 0 || !docType || !selectedSessionId || uploading || activeSessions.length === 0}
                    className="w-full"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Document
                      </>
                    )}
                  </Button>
                </div>
              )}

              {uploading && (
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-900"></div>
                  <p className="mt-2 text-sm text-gray-600">Uploading files...</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
              <p className="mt-4 text-gray-600">Loading assistant information...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function AssistantUploadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
              <p className="mt-4 text-gray-600">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <AssistantUploadContent />
    </Suspense>
  )
}

