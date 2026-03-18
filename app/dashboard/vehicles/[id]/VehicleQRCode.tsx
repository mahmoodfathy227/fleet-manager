'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { QrCode, Download, RefreshCw } from 'lucide-react'

interface VehicleQRCodeProps {
  vehicleId: number
}

export default function VehicleQRCode({ vehicleId }: VehicleQRCodeProps) {
  const [qrToken, setQrToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [vehicleIdentifier, setVehicleIdentifier] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadQrToken()
  }, [vehicleId])

  const loadQrToken = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('vehicles')
      .select('qr_token, vehicle_identifier')
      .eq('id', vehicleId)
      .single()

    if (!error && data) {
      setVehicleIdentifier(data.vehicle_identifier)
      
      // If no QR token exists, generate one
      if (!data.qr_token) {
        const newToken = crypto.randomUUID()
        const { error: updateError } = await supabase
          .from('vehicles')
          .update({ qr_token: newToken })
          .eq('id', vehicleId)
        
        if (!updateError) {
          setQrToken(newToken)
          generateQRCode(newToken)
        }
      } else {
        setQrToken(data.qr_token)
        generateQRCode(data.qr_token)
      }
    }
    setLoading(false)
  }

  const generateQRCode = (token: string) => {
    // Get the base URL (use window.location.origin for client-side)
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'
    
    // QR code links to supplier-facing vehicle page
    const qrUrl = `${baseUrl}/supplier/vehicle/${token}`
    
    // Use a QR code API service
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`
    setQrCodeUrl(qrApiUrl)
  }

  const handleRegenerateToken = async () => {
    if (!confirm('Are you sure you want to regenerate the QR code? The old QR code will no longer work.')) {
      return
    }

    setLoading(true)
    const newToken = crypto.randomUUID()
    const { error } = await supabase
      .from('vehicles')
      .update({ qr_token: newToken })
      .eq('id', vehicleId)

    if (!error) {
      setQrToken(newToken)
      generateQRCode(newToken)
    } else {
      alert('Error regenerating QR token: ' + error.message)
    }
    setLoading(false)
  }

  const handleDownloadQR = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a')
      link.href = qrCodeUrl
      link.download = `vehicle-${vehicleId}-${vehicleIdentifier || 'qr'}-code.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="bg-navy text-white">
          <CardTitle className="text-white flex items-center">
            <QrCode className="mr-2 h-5 w-5" />
            Vehicle QR Code
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="bg-navy text-white">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center">
            <QrCode className="mr-2 h-5 w-5" />
            Vehicle QR Code
          </CardTitle>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRegenerateToken}
            disabled={loading}
            className="bg-white text-navy hover:bg-gray-100"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Regenerate
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="text-sm text-gray-600 text-center">
            Scan this QR code to view vehicle details
          </div>
          
          {qrCodeUrl && qrToken && (
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-white rounded-lg border-2 border-gray-200">
                <img 
                  src={qrCodeUrl} 
                  alt="Vehicle QR Code" 
                  className="w-64 h-64"
                />
              </div>
              
              <div className="flex space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadQR}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download QR Code
                </Button>
              </div>
              
              <div className="text-xs text-gray-500 text-center max-w-md">
                <p>
                  <strong>Vehicle:</strong> {vehicleIdentifier || `Vehicle #${vehicleId}`}
                </p>
                <p className="mt-1">
                  <strong>QR Token:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{qrToken}</code>
                </p>
                <p className="mt-2">
                  This QR code can be scanned to quickly access vehicle information and details.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

