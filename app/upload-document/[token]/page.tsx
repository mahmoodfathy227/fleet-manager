'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Camera, Upload, FileCheck, X, CheckCircle, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function UploadDocumentPage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [notification, setNotification] = useState<any>(null)
  const [recipientName, setRecipientName] = useState<string>('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [useCamera, setUseCamera] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [token, setToken] = useState<string>('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    async function getToken() {
      const resolvedParams = await params
      setToken(resolvedParams.token)
    }
    getToken()
  }, [params])

  useEffect(() => {
    if (token) {
      loadNotification()
    }
  }, [token])

  useEffect(() => {
    return () => {
      // Cleanup camera stream on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const loadNotification = async () => {
    if (!token) return
    try {
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*, recipient:recipient_employee_id(full_name)')
        .eq('email_token', token)
        .single()

      if (fetchError || !data) {
        setError('Invalid or expired upload link')
        setLoading(false)
        return
      }

      setNotification(data)
      
      // Get recipient name for greeting
      if (data.recipient?.full_name) {
        setRecipientName(data.recipient.full_name)
      } else if (data.recipient_email) {
        setRecipientName(data.recipient_email.split('@')[0])
      }
      
      setLoading(false)
    } catch (err: any) {
      setError(err.message || 'Failed to load notification')
      setLoading(false)
    }
  }

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera not supported in this browser. Please use file upload instead.')
      return
    }
    try {
      setError(null)
      setCameraReady(false)
      
      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      
      // Set useCamera first so the video element is rendered
      setUseCamera(true)
      
      // Wait a bit for the video element to be rendered
      await new Promise(resolve => setTimeout(resolve, 200))
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }, // back camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      streamRef.current = stream
      
      // Wait for video element to be available
      if (videoRef.current) {
        const video = videoRef.current
        
        // Set the stream
        video.srcObject = stream
        
        // Wait for metadata to load
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn('Video metadata timeout')
            resolve()
          }, 3000)
          
          const onLoadedMetadata = () => {
            clearTimeout(timeout)
            console.log('Video metadata loaded')
            video.removeEventListener('loadedmetadata', onLoadedMetadata)
            resolve()
          }
          
          video.addEventListener('loadedmetadata', onLoadedMetadata)
          
          // Also try to play immediately
          video.play().catch(() => {
            // Will retry after metadata loads
          })
        })
        
        // Play the video
        try {
          await video.play()
          console.log('Video playing')
          setCameraReady(true)
        } catch (playErr: any) {
          console.warn('Video play error:', playErr)
          // Try again after a short delay
          await new Promise(resolve => setTimeout(resolve, 300))
          if (videoRef.current) {
            try {
              await videoRef.current.play()
              console.log('Video playing after retry')
              setCameraReady(true)
            } catch (e) {
              console.error('Retry play failed:', e)
              throw new Error('Failed to play video stream')
            }
          }
        }
      } else {
        throw new Error('Video element not found')
      }
    } catch (err: any) {
      console.error('Camera error:', err)
      setError(
        'Failed to access camera. Ensure camera permission is allowed and you are on HTTPS. Error: ' +
          (err.message || 'Unknown error')
      )
      setUseCamera(false)
      setCameraReady(false)
      // Clean up on error
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setUseCamera(false)
    setCameraReady(false)
  }

  const capturePhoto = () => {
    if (!videoRef.current) return

    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0)
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' })
          handleFileAdd(file)
        }
      }, 'image/jpeg', 0.9)
    }
    stopCamera()
  }

  const handleFileAdd = (file: File) => {
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

    setFiles(prev => [...prev, file])
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreviews(prev => [...prev, e.target?.result as string])
      }
      reader.readAsDataURL(file)
    } else {
      setPreviews(prev => [...prev, ''])
    }

    setError(null)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (selectedFiles && selectedFiles.length > 0) {
      Array.from(selectedFiles).forEach(file => handleFileAdd(file))
      // Reset the input so the same file can be selected again
      e.target.value = ''
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Please select at least one file to upload.')
      return
    }

    if (!notification) {
      setError('Notification not found')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const uploadedFiles: string[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileExt = file.name.split('.').pop() || 'bin'
        const timestamp = Date.now()
        const randomStr = Math.random().toString(36).substring(2, 15)
        
        // Determine storage path based on entity type
        let storagePath = ''
        let bucketName = ''
        
        if (notification.entity_type === 'vehicle') {
          bucketName = 'VEHICLE_DOCUMENTS'
          storagePath = `vehicles/${notification.entity_id}/${notification.certificate_type}_${timestamp}_${i}_${randomStr}.${fileExt}`
        } else if (notification.entity_type === 'driver' || notification.entity_type === 'assistant') {
          bucketName = 'EMPLOYEE_DOCUMENTS'
          storagePath = `employees/${notification.entity_id}/${notification.certificate_type}_${timestamp}_${i}_${randomStr}.${fileExt}`
        } else {
          bucketName = 'DOCUMENTS'
          storagePath = `notifications/${notification.id}/${timestamp}_${i}_${randomStr}.${fileExt}`
        }

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(bucketName)
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          // Provide helpful error message for bucket not found
          if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('not found')) {
            throw new Error(
              `Storage bucket "${bucketName}" not found. Please ensure the bucket exists in your Supabase Storage settings. ` +
              `Required buckets: VEHICLE_DOCUMENTS, EMPLOYEE_DOCUMENTS, DOCUMENTS. ` +
              `Run migration 064_create_required_storage_buckets.sql to create them automatically.`
            )
          }
          throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`)
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from(bucketName)
          .getPublicUrl(storagePath)

        uploadedFiles.push(publicUrl)

        // Save to documents table
        const docPayload: any = {
          employee_id:
            notification.entity_type === 'vehicle' ? null : notification.recipient_employee_id,
          vehicle_id: notification.entity_type === 'vehicle' ? notification.entity_id : null,
          file_name: file.name,
          file_type: file.type,
          file_path: storagePath,
          file_url: publicUrl,
          doc_type: notification.certificate_name,
          uploaded_by: null, // Uploaded via token, no user ID
        }

        const { error: docError } = await supabase.from('documents').insert(docPayload)

        if (docError) {
          console.error('Error saving document record:', docError)
          // Continue even if document record fails
        }
      }

      // Update notification status to resolved
      const { error: updateError } = await supabase
        .from('notifications')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString()
        })
        .eq('id', notification.id)

      if (updateError) {
        console.error('Error updating notification:', updateError)
      }

      // Get entity name for admin summary
      let entityName = ''
      if (notification.entity_type === 'vehicle') {
        const { data: vehicle } = await supabase
          .from('vehicles')
          .select('vehicle_identifier, registration')
          .eq('id', notification.entity_id)
          .single()
        entityName = vehicle?.vehicle_identifier || vehicle?.registration || `Vehicle #${notification.entity_id}`
      } else if (notification.entity_type === 'driver' || notification.entity_type === 'assistant') {
        const { data: employee } = await supabase
          .from('employees')
          .select('full_name')
          .eq('id', notification.entity_id)
          .single()
        entityName = employee?.full_name || `${notification.entity_type} #${notification.entity_id}`
      }

      // Create system activity instead of sending email
      try {
        await fetch('/api/admin/notify-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'document_upload',
            notificationId: notification.id,
            recipientName: recipientName || notification.recipient_email?.split('@')[0],
            recipientEmail: notification.recipient_email,
            entityType: notification.entity_type,
            entityName: entityName,
            certificateName: notification.certificate_name,
            details: {
              filesUploaded: files.length,
              fileNames: files.map(f => f.name),
              uploadedFileUrls: uploadedFiles,
            },
          }),
        })
      } catch (summaryError) {
        console.error('Failed to create system activity:', summaryError)
        // Don't fail the upload if activity creation fails
      }

      setSuccess(true)
      setFiles([])
      setPreviews([])
    } catch (err: any) {
      setError(err.message || 'Failed to upload documents')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (error && !notification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Link</h2>
              <p className="text-gray-600">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Upload Successful!</h2>
              <p className="text-gray-600 mb-4">
                Your documents have been uploaded successfully. Thank you for submitting the required documents.
              </p>
              <p className="text-sm text-gray-500">
                You can close this page now.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl sm:text-2xl">Upload Required Documents</CardTitle>
            {recipientName && (
              <p className="text-sm text-gray-600 mt-2">
                Hello {recipientName},
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {notification && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">Certificate Information</h3>
                <div className="space-y-1 text-sm text-gray-700">
                  <p><strong>Certificate:</strong> {notification.certificate_name}</p>
                  <p><strong>Expiry Date:</strong> {new Date(notification.expiry_date).toLocaleDateString()}</p>
                  <p><strong>Status:</strong> {
                    notification.days_until_expiry < 0
                      ? `Expired ${Math.abs(notification.days_until_expiry)} days ago`
                      : `Expires in ${notification.days_until_expiry} days`
                  }</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <Label>Upload Documents</Label>
                <p className="text-sm text-gray-500 mb-4">
                  You can upload images or PDF files. Use the camera button to scan documents directly.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      if (useCamera) {
                        stopCamera()
                      } else {
                        startCamera()
                      }
                    }}
                    className="flex-1 sm:flex-initial"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    {useCamera ? 'Stop Camera' : 'Use Camera'}
                  </Button>
                  
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const input = document.getElementById('file-upload') as HTMLInputElement
                      if (input) {
                        input.click()
                      }
                    }}
                    className="flex-1 sm:flex-initial"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Choose Files
                  </Button>
                  <Input
                    id="file-upload"
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </div>

                {useCamera && (
                  <div className="mb-4">
                    <div className="relative bg-black rounded-lg overflow-hidden w-full" style={{ minHeight: '250px', maxHeight: '500px' }}>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-auto"
                        style={{ 
                          display: 'block',
                          objectFit: 'contain',
                          width: '100%',
                          height: 'auto',
                          minHeight: '250px',
                          maxHeight: '500px',
                          backgroundColor: '#000'
                        }}
                        onLoadedMetadata={() => {
                          console.log('Video metadata loaded in element')
                        }}
                        onCanPlay={() => {
                          console.log('Video can play')
                          setCameraReady(true)
                        }}
                        onPlay={() => {
                          console.log('Video is playing')
                          setCameraReady(true)
                        }}
                        onError={(e) => {
                          console.error('Video element error:', e)
                          setCameraReady(false)
                        }}
                      />
                      {!cameraReady && (
                        <div className="absolute inset-0 flex items-center justify-center text-white z-10 bg-black bg-opacity-75">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-2"></div>
                            <p className="text-sm">Starting camera...</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 mt-2">
                      <Button
                        type="button"
                        onClick={capturePhoto}
                        className="flex-1"
                        disabled={!cameraReady || !streamRef.current}
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Capture Document
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={stopCamera}
                        className="flex-1 sm:flex-initial"
                      >
                        Stop Camera
                      </Button>
                    </div>
                  </div>
                )}

                {files.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selected Files ({files.length})</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {files.map((file, index) => (
                        <div key={index} className="border rounded-lg p-2 relative">
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                          {previews[index] ? (
                            <img
                              src={previews[index]}
                              alt={file.name}
                              className="w-full h-32 object-contain rounded"
                            />
                          ) : (
                            <div className="w-full h-32 flex items-center justify-center bg-gray-100 rounded">
                              <FileCheck className="h-8 w-8 text-gray-400" />
                            </div>
                          )}
                          <p className="text-xs text-gray-600 mt-2 truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Button
                onClick={handleUpload}
                disabled={uploading || files.length === 0}
                className="w-full"
              >
                {uploading ? 'Uploading...' : `Upload ${files.length} File${files.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

