'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { QrCode, Download, RefreshCw } from 'lucide-react'

interface PassengerAssistantQRCodeProps {
  assistantId: number
}

export default function PassengerAssistantQRCode({ assistantId }: PassengerAssistantQRCodeProps) {
  const [qrToken, setQrToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [assistantName, setAssistantName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    loadQrToken()
  }, [assistantId])

  const loadQrToken = async () => {
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('passenger_assistants')
      .select(`
        qr_token,
        employees(full_name)
      `)
      .eq('id', assistantId)
      .single()

    if (fetchError) {
      setError(`Failed to load QR token: ${fetchError.message}`)
      setLoading(false)
      return
    }

    if (!data) {
      setError('Passenger assistant not found')
      setLoading(false)
      return
    }

    const employee = Array.isArray(data.employees) ? data.employees[0] : data.employees
    setAssistantName(employee?.full_name || null)

    // If no QR token exists, generate one automatically
    if (!data.qr_token) {
      await generateToken()
    } else {
      setQrToken(data.qr_token)
      generateQRCode(data.qr_token)
    }
    setLoading(false)
  }

  const generateToken = async () => {
    setLoading(true)
    setError(null)
    const { data, error: updateError } = await supabase
      .from('passenger_assistants')
      .update({ qr_token: crypto.randomUUID() })
      .eq('id', assistantId)
      .select('qr_token')
      .single()

    if (updateError) {
      setError(`Failed to generate QR token: ${updateError.message}`)
      setLoading(false)
      return
    }

    if (data?.qr_token) {
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
    
    const qrUrl = `${baseUrl}/assistant/upload?token=${token}`
    
    // Use a QR code API service
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`
    setQrCodeUrl(qrApiUrl)
  }

  const handleRegenerateToken = async () => {
    if (!confirm('Are you sure you want to regenerate the QR code? The old QR code will no longer work.')) {
      return
    }

    setLoading(true)
    const { error } = await supabase
      .from('passenger_assistants')
      .update({ qr_token: crypto.randomUUID() })
      .eq('id', assistantId)

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
      link.download = `assistant-${assistantId}-qr-code.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="bg-blue-900 text-white">
          <CardTitle className="text-white">Document Upload QR Code</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-900"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error && !loading) {
    return (
      <Card>
        <CardHeader className="bg-blue-900 text-white">
          <CardTitle className="text-white">Document Upload QR Code</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <p className="text-red-600">{error}</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={loadQrToken}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!qrToken && !loading) {
    return (
      <Card>
        <CardHeader className="bg-blue-900 text-white">
          <CardTitle className="text-white">Document Upload QR Code</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <p className="text-gray-500">No QR token found. Click below to generate one.</p>
            <Button
              variant="secondary"
              size="sm"
              onClick={generateToken}
              disabled={loading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Generate QR Code
            </Button>
          </div>
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
            Document Upload QR Code
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
          {assistantName && (
            <div className="text-center">
              <p className="text-sm text-gray-600">Passenger Assistant</p>
              <p className="text-lg font-semibold text-gray-900">{assistantName}</p>
            </div>
          )}
          
          <div className="text-sm text-gray-600 text-center">
            Scan this QR code to upload required documents
          </div>
          
          {qrCodeUrl ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-white rounded-lg border-2 border-gray-200">
                <img 
                  src={qrCodeUrl} 
                  alt="Passenger Assistant QR Code" 
                  className="w-64 h-64"
                  onError={() => setError('Failed to load QR code image')}
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
                  Passenger assistants can scan this code with their mobile device to upload required documents (images, PDFs, etc.).
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500">
              <p>Generating QR code...</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

