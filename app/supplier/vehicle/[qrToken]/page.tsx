'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { 
  Car, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  MessageSquare, 
  Wrench,
  Calendar,
  FileText,
  Save,
  RefreshCw,
  Upload,
  Image,
  X,
  Download
} from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'

interface Vehicle {
  id: number
  vehicle_identifier: string | null
  registration: string | null
  plate_number: string | null
  make: string | null
  model: string | null
  vehicle_type: string | null
  off_the_road: boolean | null
  notes: string | null
  mot_date: string | null
  insurance_expiry_date: string | null
  last_serviced: string | null
  [key: string]: any
}

interface VehicleUpdate {
  id: number
  update_text: string
  created_at: string
  updated_by: number | null
  file_urls?: string[] | null
  users?: {
    email: string | null
  } | null
}

export default function SupplierVehiclePage() {
  const params = useParams()
  const qrToken = params?.qrToken as string
  const supabase = createClient()
  
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [updates, setUpdates] = useState<VehicleUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  
  // Form states
  const [notes, setNotes] = useState('')
  const [vorStatus, setVorStatus] = useState(false)
  const [newUpdateText, setNewUpdateText] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [filePreviews, setFilePreviews] = useState<Array<{ url: string; name: string; type: string }>>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (qrToken) {
      loadVehicle()
    }
  }, [qrToken])

  const loadVehicle = async () => {
    if (!qrToken) {
      setError('Invalid QR token')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Load vehicle by QR token
      const { data: vehicleData, error: vehicleError } = await supabase
        .from('vehicles')
        .select('*')
        .eq('qr_token', qrToken)
        .single()

      if (vehicleError || !vehicleData) {
        setError('Vehicle not found with this QR code')
        setVehicle(null)
        setLoading(false)
        return
      }

      setVehicle(vehicleData)
      setNotes(vehicleData.notes || '')
      setVorStatus(vehicleData.off_the_road || false)

      // Load vehicle updates
      const { data: updatesData, error: updatesError } = await supabase
        .from('vehicle_updates')
        .select('*, users(email)')
        .eq('vehicle_id', vehicleData.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!updatesError && updatesData) {
        // Parse file_urls if they exist
        const parsedUpdates = updatesData.map(update => ({
          ...update,
          file_urls: typeof update.file_urls === 'string' 
            ? JSON.parse(update.file_urls) 
            : (update.file_urls || [])
        }))
        setUpdates(parsedUpdates)
      }

    } catch (err: any) {
      console.error('Error loading vehicle:', err)
      setError(err.message || 'Failed to load vehicle information')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveNotes = async () => {
    if (!vehicle) return

    setSaving(true)
    setSuccess(false)
    setError(null)

    try {
      const updateData: any = {
        notes: notes,
        updated_at: new Date().toISOString(),
      }

      const { error: updateError } = await supabase
        .from('vehicles')
        .update(updateData)
        .eq('id', vehicle.id)
        .eq('qr_token', qrToken) // Ensure we can only update via QR token

      if (updateError) throw updateError

      // Add vehicle update entry
      const updateText = supplierName 
        ? `📝 Notes updated by ${supplierName}: ${notes || '(cleared)'}`
        : `📝 Notes updated: ${notes || '(cleared)'}`

      await supabase
        .from('vehicle_updates')
        .insert({
          vehicle_id: vehicle.id,
          update_text: updateText,
        })

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      await loadVehicle()
    } catch (err: any) {
      console.error('Error saving notes:', err)
      setError(err.message || 'Failed to save notes')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleVOR = async () => {
    if (!vehicle) return

    const newVorStatus = !vorStatus
    const confirmMessage = newVorStatus
      ? 'Are you sure you want to mark this vehicle as VOR (Vehicle Off Road)?'
      : 'Are you sure you want to mark this vehicle as Active?'

    if (!confirm(confirmMessage)) return

    setSaving(true)
    setSuccess(false)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('vehicles')
        .update({
          off_the_road: newVorStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', vehicle.id)
        .eq('qr_token', qrToken) // Ensure we can only update via QR token

      if (updateError) throw updateError

      // Add vehicle update entry
      const updateText = supplierName
        ? `🚩 Vehicle status changed by ${supplierName}: ${newVorStatus ? 'VOR (Vehicle Off Road)' : 'Active'}`
        : `🚩 Vehicle status changed: ${newVorStatus ? 'VOR (Vehicle Off Road)' : 'Active'}`

      await supabase
        .from('vehicle_updates')
        .insert({
          vehicle_id: vehicle.id,
          update_text: updateText,
        })

      setVorStatus(newVorStatus)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      await loadVehicle()
    } catch (err: any) {
      console.error('Error updating VOR status:', err)
      setError(err.message || 'Failed to update vehicle status')
    } finally {
      setSaving(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return

    const files = Array.from(e.target.files)
    setSelectedFiles(prev => [...prev, ...files])

    // Create previews for images
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          if (e.target?.result) {
            setFilePreviews(prev => [...prev, {
              url: e.target!.result as string,
              name: file.name,
              type: file.type
            }])
          }
        }
        reader.readAsDataURL(file)
      } else {
        setFilePreviews(prev => [...prev, {
          url: '',
          name: file.name,
          type: file.type
        }])
      }
    })
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    setFilePreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleAddUpdate = async () => {
    if (!vehicle || !newUpdateText.trim()) return

    setSaving(true)
    setUploading(true)
    setError(null)

    try {
      const uploadedFileUrls: string[] = []

      // Upload files if any
      if (selectedFiles.length > 0) {
        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i]
          const fileExt = file.name.split('.').pop() || 'bin'
          const timestamp = Date.now()
          const randomStr = Math.random().toString(36).substring(2, 15)
          const storagePath = `vehicles/${vehicle.id}/updates/${timestamp}_${i}_${randomStr}.${fileExt}`

          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('VEHICLE_DOCUMENTS')
            .upload(storagePath, file, {
              cacheControl: '3600',
              upsert: false,
            })

          if (uploadError) {
            console.error('Error uploading file:', uploadError)
            throw new Error(`Failed to upload file ${file.name}: ${uploadError.message}`)
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('VEHICLE_DOCUMENTS')
            .getPublicUrl(storagePath)

          uploadedFileUrls.push(publicUrl)
        }
      }

      const updateText = supplierName
        ? `📋 ${supplierName}: ${newUpdateText}`
        : `📋 ${newUpdateText}`

      const { error: insertError } = await supabase
        .from('vehicle_updates')
        .insert({
          vehicle_id: vehicle.id,
          update_text: updateText,
          file_urls: uploadedFileUrls.length > 0 ? uploadedFileUrls : null,
        })

      if (insertError) throw insertError

      setNewUpdateText('')
      setSelectedFiles([])
      setFilePreviews([])
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      await loadVehicle()
    } catch (err: any) {
      console.error('Error adding update:', err)
      setError(err.message || 'Failed to add update')
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy mb-4"></div>
              <p className="text-gray-600">Loading vehicle information...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error && !vehicle) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="bg-red-600 text-white">
            <CardTitle className="flex items-center">
              <AlertCircle className="mr-2 h-5 w-5" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <XCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <p className="text-gray-900 font-medium mb-2">{error}</p>
              <p className="text-sm text-gray-600 mb-4">
                Please check the QR code and try again.
              </p>
              <Button onClick={() => window.location.reload()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!vehicle) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="bg-navy text-white">
            <CardTitle className="flex items-center">
              <Car className="mr-2 h-5 w-5" />
              Vehicle Information - Supplier Portal
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Supplier Name (Optional)</Label>
                <Input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Enter your name or company name"
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Details */}
        <Card>
          <CardHeader className="bg-navy text-white">
            <CardTitle className="flex items-center">
              <Car className="mr-2 h-5 w-5" />
              Vehicle Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Vehicle Identifier</Label>
                <div className="mt-1 font-medium text-lg">
                  {vehicle.vehicle_identifier || `Vehicle #${vehicle.id}`}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Registration</Label>
                <div className="mt-1 text-lg">
                  {vehicle.registration || vehicle.plate_number || 'N/A'}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Make & Model</Label>
                <div className="mt-1">
                  {vehicle.make && vehicle.model 
                    ? `${vehicle.make} ${vehicle.model}`
                    : vehicle.make || vehicle.model || 'N/A'}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Vehicle Type</Label>
                <div className="mt-1">{vehicle.vehicle_type || 'N/A'}</div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">MOT Expiry</Label>
                <div className="mt-1">{vehicle.mot_date ? formatDate(vehicle.mot_date) : 'N/A'}</div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Insurance Expiry</Label>
                <div className="mt-1">
                  {vehicle.insurance_expiry_date ? formatDate(vehicle.insurance_expiry_date) : 'N/A'}
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Last Serviced</Label>
                <div className="mt-1">
                  {vehicle.last_serviced ? formatDate(vehicle.last_serviced) : 'N/A'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Toggle */}
        <Card>
          <CardHeader className="bg-navy text-white">
            <CardTitle className="flex items-center">
              <AlertCircle className="mr-2 h-5 w-5" />
              Vehicle Status
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-gray-700">Current Status</Label>
                  <div className="mt-1">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      vorStatus
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {vorStatus ? (
                        <>
                          <XCircle className="mr-1 h-4 w-4" />
                          VOR (Vehicle Off Road)
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-1 h-4 w-4" />
                          Active
                        </>
                      )}
                    </span>
                  </div>
                </div>
                <Button
                  onClick={handleToggleVOR}
                  disabled={saving}
                  variant={vorStatus ? 'primary' : 'secondary'}
                  className={vorStatus ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                >
                  {saving ? (
                    'Updating...'
                  ) : vorStatus ? (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Mark as Active
                    </>
                  ) : (
                    <>
                      <XCircle className="mr-2 h-4 w-4" />
                      Mark as VOR
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader className="bg-navy text-white">
            <CardTitle className="flex items-center">
              <FileText className="mr-2 h-5 w-5" />
              Vehicle Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="notes" className="text-sm font-medium text-gray-700">
                  Notes
                </Label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about the vehicle..."
                  rows={6}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveNotes}
                  disabled={saving}
                >
                  {saving ? (
                    'Saving...'
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Notes
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add Update */}
        <Card>
          <CardHeader className="bg-navy text-white">
            <CardTitle className="flex items-center">
              <MessageSquare className="mr-2 h-5 w-5" />
              Add Vehicle Update
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="update-text" className="text-sm font-medium text-gray-700">
                  Update/Note
                </Label>
                <textarea
                  id="update-text"
                  value={newUpdateText}
                  onChange={(e) => setNewUpdateText(e.target.value)}
                  placeholder="Add an update about this vehicle (e.g., service completed, issue found, etc.)..."
                  rows={4}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-navy"
                />
              </div>
              
              {/* File Upload */}
              <div>
                <Label htmlFor="file-upload" className="text-sm font-medium text-gray-700">
                  Add Photos/Files (Optional)
                </Label>
                <div className="mt-2">
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <label htmlFor="file-upload">
                    <Button
                      type="button"
                      variant="secondary"
                      className="cursor-pointer"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Select Files
                    </Button>
                  </label>
                </div>
                
                {/* File Previews */}
                {filePreviews.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {filePreviews.map((preview, index) => (
                      <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 rounded border">
                        {preview.type.startsWith('image/') && preview.url ? (
                          <img src={preview.url} alt={preview.name} className="h-12 w-12 object-cover rounded" />
                        ) : (
                          <FileText className="h-12 w-12 text-gray-400" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{preview.name}</p>
                          <p className="text-xs text-gray-500">{preview.type}</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleAddUpdate}
                  disabled={saving || uploading || !newUpdateText.trim()}
                >
                  {saving || uploading ? (
                    'Adding...'
                  ) : (
                    <>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Add Update
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vehicle Updates History */}
        <Card>
          <CardHeader className="bg-navy text-white">
            <CardTitle className="flex items-center">
              <MessageSquare className="mr-2 h-5 w-5" />
              Vehicle Updates History ({updates.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {updates.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                <p>No updates yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {updates.map((update) => (
                  <div
                    key={update.id}
                    className="border-l-4 border-navy pl-4 py-2 bg-gray-50 rounded-r"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{update.update_text}</p>
                        <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                          <span className="flex items-center">
                            <Calendar className="mr-1 h-3 w-3" />
                            {formatDateTime(update.created_at)}
                          </span>
                          {update.users?.email && (
                            <span>By: {update.users.email}</span>
                          )}
                        </div>
                        
                        {/* Display attached files */}
                        {update.file_urls && update.file_urls.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-medium text-gray-700">Attachments:</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {update.file_urls.map((fileUrl, idx) => {
                                const isImage = fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)
                                return (
                                  <a
                                    key={idx}
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="relative group border border-gray-200 rounded p-2 hover:bg-gray-100 transition-colors"
                                  >
                                    {isImage ? (
                                      <div className="relative">
                                        <img
                                          src={fileUrl}
                                          alt={`Attachment ${idx + 1}`}
                                          className="w-full h-20 object-cover rounded"
                                        />
                                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity rounded flex items-center justify-center">
                                          <Download className="h-4 w-4 text-white opacity-0 group-hover:opacity-100" />
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex flex-col items-center justify-center h-20">
                                        <FileText className="h-8 w-8 text-gray-400 mb-1" />
                                        <span className="text-xs text-gray-600 truncate w-full text-center">
                                          {fileUrl.split('/').pop()?.substring(0, 15)}...
                                        </span>
                                      </div>
                                    )}
                                  </a>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Success/Error Messages */}
        {success && (
          <div className="fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2">
            <CheckCircle className="h-5 w-5" />
            <span>Changes saved successfully!</span>
          </div>
        )}

        {error && (
          <div className="fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  )
}

