'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { QrCode, Download, RefreshCw } from 'lucide-react'

interface DriverQRCodeProps {
  driverId: number
}

export default function DriverQRCode({ driverId }: DriverQRCodeProps) {
  const [qrToken, setQrToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadQrToken()
  }, [driverId])

  const loadQrToken = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('drivers')
      .select('qr_token')
      .eq('employee_id', driverId)
      .single()

    if (!error && data?.qr_token) {
      setQrToken(data.qr_token)
      generateQRCode(data.qr_token)
    }
    setLoading(false)
  }

  const generateQRCode = (token: string) => {
    // Get the base URL (use window.location.origin for client-side)
    const baseUrl = typeof window !== 'undefined' 
      ? window.location.origin 
      : process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'
    
    const qrUrl = `${baseUrl}/start-session/${token}`
    
    // Use a QR code API service (like qrcode.tec-it.com or similar)
    // Or use a library like qrcode.react
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`
    setQrCodeUrl(qrApiUrl)
  }

  const handleRegenerateToken = async () => {
    setLoading(true)
    const { error } = await supabase
      .from('drivers')
      .update({ qr_token: crypto.randomUUID() })
      .eq('employee_id', driverId)

    if (!error) {
      await loadQrToken()
    } else {
      alert('Error regenerating QR token: ' + error.message)
    }
    setLoading(false)
  }

  const handleDownloadQR = () => {
    if (qrCodeUrl) {
      const link = document.createElement('a')
      link.href = qrCodeUrl
      link.download = `driver-${driverId}-qr-code.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="bg-blue-900 text-white">
          <CardTitle className="text-white">QR Code</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!qrToken) {
    return (
      <Card>
        <CardHeader className="bg-blue-900 text-white">
          <CardTitle className="text-white">QR Code</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <p className="text-center text-gray-500">No QR token found. Please contact administrator.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="bg-blue-900 text-white">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center">
            <QrCode className="mr-2 h-5 w-5" />
            Driver QR Code
          </CardTitle>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRegenerateToken}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Regenerate
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="text-sm text-gray-600 text-center">
            Scan this QR code to start a route session
          </div>
          
          {qrCodeUrl && (
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-white rounded-lg border-2 border-gray-200">
                <img 
                  src={qrCodeUrl} 
                  alt="Driver QR Code" 
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
                <p>QR Token: <code className="bg-gray-100 px-2 py-1 rounded">{qrToken}</code></p>
                <p className="mt-2">
                  Drivers can scan this code with their mobile device to quickly start a route session.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

