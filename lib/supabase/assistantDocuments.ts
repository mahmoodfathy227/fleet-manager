import { createClient } from '@/lib/supabase/client'

/**
 * Uploads a document for a passenger assistant via QR token
 * @param token - QR token from passenger assistant
 * @param files - File(s) to upload (multiple files allowed for one document)
 * @param docType - Type/category of document (TR1-TR6)
 * @param routeSessionId - Route session ID to link document to
 * @returns Promise with success status and document details or error
 */
export async function uploadAssistantDocument(
  token: string,
  files: File[],
  docType: string,
  routeSessionId: number
): Promise<{ success: boolean; error?: string; documentId?: number; fileUrls?: string[] }> {
  const supabase = createClient()

  // Validate files
  if (!files || files.length === 0) {
    return {
      success: false,
      error: 'Please select at least one file to upload.',
    }
  }

  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/pdf',
  ]

  const maxSize = 10 * 1024 * 1024 // 10 MB in bytes

  // Validate all files
  for (const file of files) {
    if (!allowedMimeTypes.includes(file.type)) {
      return {
        success: false,
        error: `Invalid file type for ${file.name}. Only images (JPEG, PNG, GIF) and PDF files are allowed.`,
      }
    }
    if (file.size > maxSize) {
      return {
        success: false,
        error: `File size exceeds 10 MB limit for ${file.name}.`,
      }
    }
  }

  try {
    // First, get the assistant ID from the QR token
    const { data: assistantData, error: assistantError } = await supabase
      .from('passenger_assistants')
      .select('id')
      .eq('qr_token', token)
      .single()

    if (assistantError || !assistantData) {
      return {
        success: false,
        error: 'Invalid QR token. Please scan a valid passenger assistant QR code.',
      }
    }

    const assistantId = assistantData.id

    // Upload all files to Supabase Storage
    const uploadedFiles: { path: string; url: string }[] = []
    const uploadedPaths: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fileExt = file.name.split('.').pop() || 'bin'
      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 15)
      const fileName = `${assistantId}/${docType}_${timestamp}_${i}_${randomStr}.${fileExt}`
      const filePath = `assistants/${fileName}`

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ROUTE_DOCUMENTS')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        // Clean up already uploaded files
        if (uploadedPaths.length > 0) {
          await supabase.storage.from('ROUTE_DOCUMENTS').remove(uploadedPaths)
        }
        
        // Provide helpful error message for bucket not found
        if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('not found')) {
          return {
            success: false,
            error: 'Storage bucket "ROUTE_DOCUMENTS" not found. Please create a public bucket named "ROUTE_DOCUMENTS" in your Supabase Storage settings.',
          }
        }
        
        return {
          success: false,
          error: `Upload failed for ${file.name}: ${uploadError.message}`,
        }
      }

      // Get public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('ROUTE_DOCUMENTS')
        .getPublicUrl(filePath)

      uploadedFiles.push({ path: filePath, url: publicUrl })
      uploadedPaths.push(filePath)
    }

    // Store all file URLs as JSON array
    const fileUrlsJson = JSON.stringify(uploadedFiles.map(f => f.url))

    // Call RPC function to create document record with all file URLs
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'upload_assistant_document_from_qr',
      {
        p_qr_token: token,
        p_file_url: fileUrlsJson, // Pass JSON array as string
        p_doc_type: docType,
        p_route_session_id: routeSessionId,
        p_uploaded_by: null,
      }
    )

    if (rpcError) {
      // If RPC fails, try to clean up the uploaded files
      if (uploadedPaths.length > 0) {
        await supabase.storage.from('ROUTE_DOCUMENTS').remove(uploadedPaths)
      }
      return {
        success: false,
        error: `Failed to record document: ${rpcError.message}`,
      }
    }

    const result = rpcData as any
    if (result.success) {
      return {
        success: true,
        documentId: result.document_id,
        fileUrls: uploadedFiles.map(f => f.url),
      }
    } else {
      // If RPC returns error, try to clean up the uploaded files
      if (uploadedPaths.length > 0) {
        await supabase.storage.from('ROUTE_DOCUMENTS').remove(uploadedPaths)
      }
      return {
        success: false,
        error: result.error || 'Failed to record document',
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    }
  }
}

