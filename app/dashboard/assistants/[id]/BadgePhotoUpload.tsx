'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Label } from '@/components/ui/Label'

interface BadgePhotoUploadProps {
  employeeId: number
  onUpload?: () => void
}

export default function BadgePhotoUpload({ employeeId, onUpload }: BadgePhotoUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, etc.)')
      return
    }

    setUploading(true)
    setError(null)
    setSuccess(false)

    try {
      const supabase = createClient()
      const fileExt = file.name.split('.').pop()
      const fileName = `assistants/${employeeId}/badge_photo_${Date.now()}.${fileExt}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ROUTE_DOCUMENTS')
        .upload(fileName, file)

      if (uploadError) {
        throw new Error(uploadError.message || 'Failed to upload badge photo')
      }

      if (uploadData) {
        const { data: { publicUrl } } = supabase.storage
          .from('ROUTE_DOCUMENTS')
          .getPublicUrl(fileName)

        // Save to documents table
        const { error: docError } = await supabase.from('documents').insert({
          employee_id: employeeId,
          file_name: file.name,
          file_type: file.type || 'image/jpeg',
          file_path: fileName,
          file_url: publicUrl,
          doc_type: 'ID Badge Photo',
          uploaded_by: null,
        })

        if (docError) {
          throw new Error(docError.message || 'Failed to save badge photo record')
        }

        setSuccess(true)
        if (onUpload) {
          onUpload()
        }
        
        // Reset file input
        e.target.value = ''
        
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(false), 3000)
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred while uploading the badge photo')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="badge_photo_upload">Upload Badge Photo</Label>
        <input
          type="file"
          id="badge_photo_upload"
          accept=".jpg,.jpeg,.png"
          onChange={handleFileChange}
          disabled={uploading}
          className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm disabled:opacity-50"
        />
        <p className="text-xs text-gray-500 mt-1">Upload a photo for the passenger assistant's ID badge (JPG, PNG)</p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-3">
          <p className="text-sm text-green-800">Badge photo uploaded successfully!</p>
        </div>
      )}

      {uploading && (
        <div className="text-sm text-gray-600">
          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-navy mr-2"></div>
          Uploading...
        </div>
      )}
    </div>
  )
}

