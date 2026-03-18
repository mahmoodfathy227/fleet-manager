'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { AlertCircle, Upload, X } from 'lucide-react'

interface IncidentDocumentUploadProps {
  incidentId: number
}

export default function IncidentDocumentUpload({
  incidentId,
}: IncidentDocumentUploadProps) {
  const router = useRouter()
  const supabase = createClient()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [showForm, setShowForm] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf']
      if (!allowedTypes.includes(file.type)) {
        setError('Invalid file type. Only images (JPEG, PNG, GIF) and PDF files are allowed.')
        return
      }

      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        setError('File size exceeds 10 MB limit.')
        return
      }

      setSelectedFile(file)
      setError(null)
      setSuccess(false)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file to upload.')
      return
    }

    setUploading(true)
    setError(null)
    setSuccess(false)

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        throw new Error('You must be logged in to upload documents')
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser.email)
        .maybeSingle()

      const fileExt = selectedFile.name.split('.').pop()
      const fileName = `incidents/${incidentId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('INCIDENT_DOCUMENT')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('not found')) {
          throw new Error('Storage bucket "INCIDENT_DOCUMENT" not found. Please create a public bucket named "INCIDENT_DOCUMENT" in your Supabase Storage settings.')
        }
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from('INCIDENT_DOCUMENT')
        .getPublicUrl(fileName)

      const { error: docError } = await supabase
        .from('documents')
        .insert({
          owner_type: 'incident',
          owner_id: incidentId,
          file_url: publicUrl,
          file_name: selectedFile.name,
          file_type: selectedFile.type || 'application/octet-stream',
          file_path: fileName,
          doc_type: 'Incident Document',
          uploaded_by: userData?.id || null,
        })

      if (docError) throw docError

      setSuccess(true)
      setSelectedFile(null)
      const fileInput = document.getElementById(`incident-${incidentId}-upload`) as HTMLInputElement
      if (fileInput) fileInput.value = ''

      router.refresh()
      setTimeout(() => {
        setShowForm(false)
        setSuccess(false)
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'An error occurred while uploading the document')
    } finally {
      setUploading(false)
    }
  }

  if (!showForm) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setShowForm(true)}
        className="text-navy"
      >
        <Upload className="mr-1 h-3 w-3" />
        Upload Doc
      </Button>
    )
  }

  return (
    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-navy">Upload Document</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setShowForm(false)
            setSelectedFile(null)
            setError(null)
            setSuccess(false)
          }}
          className="h-6 w-6 p-0"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {error && (
        <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
          Document uploaded successfully!
        </div>
      )}

      <div className="space-y-2">
        <input
          id={`incident-${incidentId}-upload`}
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileChange}
          className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs"
          disabled={uploading}
        />
        {selectedFile && (
          <p className="text-xs text-gray-600">
            {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
          </p>
        )}
        <Button
          size="sm"
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="w-full"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
      </div>
    </div>
  )
}

