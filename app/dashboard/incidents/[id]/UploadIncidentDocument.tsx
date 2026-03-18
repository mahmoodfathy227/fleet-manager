'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Card, CardContent } from '@/components/ui/Card'
import { AlertCircle, Upload, X } from 'lucide-react'

interface UploadIncidentDocumentProps {
  incidentId: number
  onSuccess?: () => void
}

export default function UploadIncidentDocument({
  incidentId,
  onSuccess,
}: UploadIncidentDocumentProps) {
  const router = useRouter()
  const supabase = createClient()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf']
      if (!allowedTypes.includes(file.type)) {
        setError('Invalid file type. Only images (JPEG, PNG, GIF) and PDF files are allowed.')
        return
      }

      // Validate file size (10 MB)
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
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        throw new Error('You must be logged in to upload documents')
      }

      // Get user ID from users table
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser.email)
        .maybeSingle()

      // Upload file to storage
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

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('INCIDENT_DOCUMENT')
        .getPublicUrl(fileName)

      // Insert document record
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
      
      // Reset file input
      const fileInput = document.getElementById('incident-document-upload') as HTMLInputElement
      if (fileInput) fileInput.value = ''

      router.refresh()
      if (onSuccess) onSuccess()
    } catch (err: any) {
      setError(err.message || 'An error occurred while uploading the document')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card className="border-2 border-blue-200 bg-blue-50">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {error && (
            <div className="flex items-start p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="flex items-start p-3 bg-green-50 border border-green-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-green-800">Success</h3>
                <p className="text-sm text-green-700 mt-1">Document uploaded successfully!</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="incident-document-upload">Upload Document</Label>
            <div className="flex items-center space-x-2">
              <input
                id="incident-document-upload"
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                className="flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm"
                disabled={uploading}
              />
              {selectedFile && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null)
                    setError(null)
                    const fileInput = document.getElementById('incident-document-upload') as HTMLInputElement
                    if (fileInput) fileInput.value = ''
                  }}
                  disabled={uploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {selectedFile && (
              <p className="text-xs text-gray-600">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
            <p className="text-xs text-gray-500">
              Allowed: Images (JPEG, PNG, GIF) and PDF files. Max size: 10 MB
            </p>
          </div>

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="w-full"
          >
            {uploading ? (
              <>Uploading...</>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

