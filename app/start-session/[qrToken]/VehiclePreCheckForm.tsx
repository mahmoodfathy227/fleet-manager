'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Label } from '@/components/ui/Label'
import { Input } from '@/components/ui/Input'
import { 
  CheckCircle, 
  XCircle, 
  Car, 
  Wrench, 
  AlertTriangle,
  FileText,
  CheckSquare,
  Video,
  Camera,
  Image as ImageIcon,
  X,
  Play,
  Upload
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface VehiclePreCheckFormProps {
  driverId: number
  routeId: number | null
  vehicleId: number | null
  sessionType: 'AM' | 'PM'
  onComplete: (checkData: VehiclePreCheckData) => void
  onCancel: () => void
}

export interface VehiclePreCheckData {
  // Vehicle Exterior Checks
  lights_working: boolean
  mirrors_adjusted: boolean
  tires_condition: boolean
  body_damage: boolean
  windows_clean: boolean
  
  // Vehicle Interior Checks
  dashboard_lights: boolean
  horn_working: boolean
  wipers_working: boolean
  seatbelts_working: boolean
  interior_clean: boolean
  
  // Safety Equipment
  first_aid_kit: boolean
  fire_extinguisher: boolean
  warning_triangle: boolean
  emergency_kit: boolean
  
  // Mechanical Checks
  engine_oil_level: boolean
  coolant_level: boolean
  brake_fluid: boolean
  fuel_level_adequate: boolean
  
  // Additional Notes
  notes?: string
  issues_found?: string
  // Media URLs (videos and pictures)
  media_urls?: Array<{ type: 'video' | 'image'; url: string; thumbnail?: string }>
}

export default function VehiclePreCheckForm({
  driverId,
  routeId,
  vehicleId,
  sessionType,
  onComplete,
  onCancel
}: VehiclePreCheckFormProps) {
  const [formData, setFormData] = useState<VehiclePreCheckData>({
    lights_working: false,
    mirrors_adjusted: false,
    tires_condition: false,
    body_damage: false,
    windows_clean: false,
    dashboard_lights: false,
    horn_working: false,
    wipers_working: false,
    seatbelts_working: false,
    interior_clean: false,
    first_aid_kit: false,
    fire_extinguisher: false,
    warning_triangle: false,
    emergency_kit: false,
    engine_oil_level: false,
    coolant_level: false,
    brake_fluid: false,
    fuel_level_adequate: false,
    notes: '',
    issues_found: '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [videos, setVideos] = useState<File[]>([])
  const [images, setImages] = useState<File[]>([])
  const [videoPreviews, setVideoPreviews] = useState<Array<{ url: string; file: File }>>([])
  const [imagePreviews, setImagePreviews] = useState<Array<{ url: string; file: File }>>([])
  const [recording, setRecording] = useState(false)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const supabase = createClient()

  const toggleCheck = (field: keyof VehiclePreCheckData) => {
    if (typeof formData[field] === 'boolean') {
      setFormData(prev => ({
        ...prev,
        [field]: !prev[field]
      }))
    }
  }

  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: true 
      })
      setMediaStream(stream)
      
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp8,opus'
      })
      
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
        const file = new File([blob], `walkaround_${Date.now()}.webm`, { type: 'video/webm' })
        setVideos(prev => [...prev, file])
        
        const previewUrl = URL.createObjectURL(blob)
        setVideoPreviews(prev => [...prev, { url: previewUrl, file }])
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
        setMediaStream(null)
      }
      
      setMediaRecorder(recorder)
      recorder.start()
      setRecording(true)
    } catch (error) {
      console.error('Error starting video recording:', error)
      alert('Failed to start video recording. Please check camera permissions.')
    }
  }

  const stopVideoRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop()
      setRecording(false)
      setMediaRecorder(null)
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop())
      setMediaStream(null)
    }
  }

  const handleVideoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    
    const file = e.target.files[0]
    setVideos(prev => [...prev, file])
    
    const previewUrl = URL.createObjectURL(file)
    setVideoPreviews(prev => [...prev, { url: previewUrl, file }])
    
    e.target.value = '' // Reset input
  }

  const removeVideo = (index: number) => {
    const preview = videoPreviews[index]
    URL.revokeObjectURL(preview.url)
    setVideos(prev => prev.filter((_, i) => i !== index))
    setVideoPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    
    const files = Array.from(e.target.files)
    setImages(prev => [...prev, ...files])
    
    files.forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target?.result) {
          setImagePreviews(prev => [...prev, {
            url: e.target!.result as string,
            file
          }])
        }
      }
      reader.readAsDataURL(file)
    })
    
    e.target.value = '' // Reset input
  }

  const removeImage = (index: number) => {
    const preview = imagePreviews[index]
    if (preview.url.startsWith('blob:')) {
      URL.revokeObjectURL(preview.url)
    }
    setImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop())
      }
      videoPreviews.forEach(preview => URL.revokeObjectURL(preview.url))
      imagePreviews.forEach(preview => {
        if (preview.url.startsWith('blob:')) {
          URL.revokeObjectURL(preview.url)
        }
      })
    }
  }, [mediaStream, videoPreviews, imagePreviews])

  const handleSubmit = async () => {
    if (!allChecksComplete) return

    setSubmitting(true)
    setUploading(true)
    try {
      const mediaUrls: Array<{ type: 'video' | 'image'; url: string; thumbnail?: string }> = []

      // Upload videos
      if (videos.length > 0 && vehicleId) {
        for (let i = 0; i < videos.length; i++) {
          const video = videos[i]
          const fileExt = video.name.split('.').pop() || 'mp4'
          const timestamp = Date.now()
          const randomStr = Math.random().toString(36).substring(2, 15)
          const storagePath = `vehicles/${vehicleId}/pre-checks/videos/${timestamp}_${i}_${randomStr}.${fileExt}`

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('VEHICLE_DOCUMENTS')
            .upload(storagePath, video, {
              cacheControl: '3600',
              upsert: false,
            })

          if (uploadError) {
            console.error('Error uploading video:', uploadError)
            continue
          }

          const { data: { publicUrl } } = supabase.storage
            .from('VEHICLE_DOCUMENTS')
            .getPublicUrl(storagePath)

          mediaUrls.push({ type: 'video', url: publicUrl })
        }
      }

      // Upload images
      if (images.length > 0 && vehicleId) {
        for (let i = 0; i < images.length; i++) {
          const image = images[i]
          const fileExt = image.name.split('.').pop() || 'jpg'
          const timestamp = Date.now()
          const randomStr = Math.random().toString(36).substring(2, 15)
          const storagePath = `vehicles/${vehicleId}/pre-checks/images/${timestamp}_${i}_${randomStr}.${fileExt}`

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('VEHICLE_DOCUMENTS')
            .upload(storagePath, image, {
              cacheControl: '3600',
              upsert: false,
            })

          if (uploadError) {
            console.error('Error uploading image:', uploadError)
            continue
          }

          const { data: { publicUrl } } = supabase.storage
            .from('VEHICLE_DOCUMENTS')
            .getPublicUrl(storagePath)

          mediaUrls.push({ type: 'image', url: publicUrl })
        }
      }

      onComplete({
        ...formData,
        media_urls: mediaUrls.length > 0 ? mediaUrls : undefined
      })
    } catch (error) {
      console.error('Error submitting pre-check:', error)
      alert('Error uploading media. Please try again.')
    } finally {
      setSubmitting(false)
      setUploading(false)
    }
  }

  const allChecksComplete = 
    formData.lights_working &&
    formData.mirrors_adjusted &&
    formData.tires_condition &&
    formData.body_damage && // body_damage = true means "no damage" confirmed
    formData.windows_clean &&
    formData.dashboard_lights &&
    formData.horn_working &&
    formData.wipers_working &&
    formData.seatbelts_working &&
    formData.interior_clean &&
    formData.first_aid_kit &&
    formData.fire_extinguisher &&
    formData.warning_triangle &&
    formData.emergency_kit &&
    formData.engine_oil_level &&
    formData.coolant_level &&
    formData.brake_fluid &&
    formData.fuel_level_adequate

  const CheckboxItem = ({ 
    label, 
    field, 
    required = true 
  }: { 
    label: string
    field: keyof VehiclePreCheckData
    required?: boolean
  }) => {
    const checked = formData[field] as boolean
    return (
      <div 
        className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-colors ${
          checked 
            ? 'bg-green-50 border-green-500' 
            : 'bg-white border-gray-300 hover:border-gray-400'
        }`}
        onClick={() => toggleCheck(field)}
      >
        <div className="flex items-center space-x-3 flex-1">
          {checked ? (
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
          ) : (
            <div className="h-5 w-5 rounded-full border-2 border-gray-400 flex-shrink-0" />
          )}
          <Label className="text-sm font-medium text-gray-900 cursor-pointer flex-1">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </Label>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-h-[80vh] overflow-y-auto">
      <div className="sticky top-0 bg-white z-10 pb-2 border-b">
        <div className="flex items-center space-x-2 mb-2">
          <Car className="h-5 w-5 text-blue-900" />
          <h3 className="text-lg font-semibold text-gray-900">
            Vehicle Pre-Check ({sessionType} Route)
          </h3>
        </div>
        <p className="text-xs text-gray-600">
          Complete all checks before starting your route
        </p>
      </div>

      {/* Vehicle Exterior Checks */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center">
          <CheckSquare className="h-4 w-4 mr-2" />
          Vehicle Exterior
        </h4>
        <CheckboxItem label="Lights working (headlights, indicators, brake lights)" field="lights_working" />
        <CheckboxItem label="Mirrors properly adjusted" field="mirrors_adjusted" />
        <CheckboxItem label="Tires in good condition (tread, pressure)" field="tires_condition" />
        <CheckboxItem label="No body damage (confirmed)" field="body_damage" />
        <CheckboxItem label="Windows clean and clear" field="windows_clean" />
      </div>

      {/* Vehicle Interior Checks */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center">
          <CheckSquare className="h-4 w-4 mr-2" />
          Vehicle Interior
        </h4>
        <CheckboxItem label="Dashboard warning lights checked" field="dashboard_lights" />
        <CheckboxItem label="Horn working" field="horn_working" />
        <CheckboxItem label="Wipers working properly" field="wipers_working" />
        <CheckboxItem label="All seatbelts functional" field="seatbelts_working" />
        <CheckboxItem label="Interior clean and tidy" field="interior_clean" />
      </div>

      {/* Safety Equipment */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center">
          <CheckSquare className="h-4 w-4 mr-2" />
          Safety Equipment
        </h4>
        <CheckboxItem label="First aid kit present" field="first_aid_kit" />
        <CheckboxItem label="Fire extinguisher present" field="fire_extinguisher" />
        <CheckboxItem label="Warning triangle present" field="warning_triangle" />
        <CheckboxItem label="Emergency kit complete" field="emergency_kit" />
      </div>

      {/* Mechanical Checks */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center">
          <Wrench className="h-4 w-4 mr-2" />
          Mechanical Checks
        </h4>
        <CheckboxItem label="Engine oil level adequate" field="engine_oil_level" />
        <CheckboxItem label="Coolant level adequate" field="coolant_level" />
        <CheckboxItem label="Brake fluid level adequate" field="brake_fluid" />
        <CheckboxItem label="Fuel level adequate" field="fuel_level_adequate" />
      </div>

      {/* Issues Found */}
      <div className="space-y-2">
        <Label htmlFor="issues_found" className="text-sm font-semibold text-gray-700 flex items-center">
          <AlertTriangle className="h-4 w-4 mr-2 text-orange-500" />
          Issues Found (if any)
        </Label>
        <textarea
          id="issues_found"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          placeholder="Describe any issues or problems found during the check..."
          value={formData.issues_found}
          onChange={(e) => setFormData(prev => ({ ...prev, issues_found: e.target.value }))}
        />
      </div>

      {/* Video Recording Section */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-gray-700 flex items-center">
          <Video className="h-4 w-4 mr-2" />
          Walkaround Video (optional)
        </Label>
        <p className="text-xs text-gray-500 mb-2">
          Record a video while walking around the vehicle to document its condition
        </p>
        
        {!recording ? (
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={startVideoRecording}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              disabled={uploading}
            >
              <Video className="h-4 w-4 mr-2" />
              Start Recording
            </Button>
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoFileSelect}
              className="hidden"
              id="video-upload"
              disabled={uploading}
            />
            <Button
              type="button"
              onClick={() => document.getElementById('video-upload')?.click()}
              variant="secondary"
              className="flex-1"
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Video
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-center p-4 bg-red-50 border-2 border-red-500 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="h-3 w-3 bg-red-600 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-red-900">Recording...</span>
              </div>
            </div>
            <Button
              type="button"
              onClick={stopVideoRecording}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              <X className="h-4 w-4 mr-2" />
              Stop Recording
            </Button>
          </div>
        )}

        {/* Video Previews */}
        {videoPreviews.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {videoPreviews.map((preview, index) => (
              <div key={index} className="relative">
                <video
                  src={preview.url}
                  className="w-full h-32 object-cover rounded-lg border-2 border-gray-300"
                  controls
                />
                <button
                  type="button"
                  onClick={() => removeVideo(index)}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                  disabled={uploading}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Photo Upload Section */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-gray-700 flex items-center">
          <Camera className="h-4 w-4 mr-2" />
          Photos (optional)
        </Label>
        <p className="text-xs text-gray-500 mb-2">
          Take or upload photos of the vehicle condition
        </p>
        
        <div className="flex gap-2">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageFileSelect}
            className="hidden"
            id="camera-capture"
            disabled={uploading}
          />
          <Button
            type="button"
            onClick={() => document.getElementById('camera-capture')?.click()}
            className="flex-1 bg-green-600 hover:bg-green-700"
            disabled={uploading}
          >
            <Camera className="h-4 w-4 mr-2" />
            Take Photo
          </Button>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageFileSelect}
            className="hidden"
            id="image-upload"
            disabled={uploading}
          />
          <Button
            type="button"
            onClick={() => document.getElementById('image-upload')?.click()}
            variant="secondary"
            className="flex-1"
            disabled={uploading}
          >
            <ImageIcon className="h-4 w-4 mr-2" />
            Upload Photos
          </Button>
        </div>

        {/* Image Previews */}
        {imagePreviews.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-2">
            {imagePreviews.map((preview, index) => (
              <div key={index} className="relative">
                <img
                  src={preview.url}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg border-2 border-gray-300"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                  disabled={uploading}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Additional Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes" className="text-sm font-semibold text-gray-700 flex items-center">
          <FileText className="h-4 w-4 mr-2" />
          Additional Notes (optional)
        </Label>
        <textarea
          id="notes"
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          placeholder="Any additional notes or observations..."
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
        />
      </div>

      {/* Completion Status */}
      <div className={`p-3 rounded-lg border-2 ${
        allChecksComplete 
          ? 'bg-green-50 border-green-500' 
          : 'bg-yellow-50 border-yellow-500'
      }`}>
        <div className="flex items-center space-x-2">
          {allChecksComplete ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
          )}
          <span className={`text-sm font-medium ${
            allChecksComplete ? 'text-green-900' : 'text-yellow-900'
          }`}>
            {allChecksComplete 
              ? 'All checks completed ✓' 
              : 'Please complete all required checks'}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3 pt-2 sticky bottom-0 bg-white border-t pt-4">
        <Button
          variant="secondary"
          onClick={onCancel}
          disabled={submitting || recording}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!allChecksComplete || submitting || recording}
          className="flex-1 bg-blue-600 hover:bg-blue-700"
        >
          {uploading ? 'Uploading Media...' : submitting ? 'Submitting...' : 'Complete Check & Start Route'}
        </Button>
      </div>
    </div>
  )
}

