'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FileDown, Loader2 } from 'lucide-react'

interface ExportTAS5ButtonProps {
  schoolId: number
  schoolName: string
}

export default function ExportTAS5Button({ schoolId, schoolName }: ExportTAS5ButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setIsExporting(true)
    setError(null)

    try {
      console.log(`[TAS5 Export] Starting export for school ${schoolId}`)

      const apiUrl = `/api/schools/${schoolId}/export-tas5`
      console.log(`[TAS5 Export] Fetching: ${apiUrl}`)

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      })

      console.log(`[TAS5 Export] Response status: ${response.status}`)
      console.log(`[TAS5 Export] Response headers:`, {
        'content-type': response.headers.get('content-type'),
        'content-length': response.headers.get('content-length'),
        'content-disposition': response.headers.get('content-disposition'),
      })

      // Check if response is OK
      if (!response.ok) {
        const contentType = response.headers.get('content-type')
        let errorMessage = `Failed to export TAS 5: ${response.status} ${response.statusText}`

        if (contentType && contentType.includes('application/json')) {
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorMessage
          } catch {
            // If JSON parsing fails, use default message
          }
        } else {
          // Try to get text error
          try {
            const errorText = await response.text()
            if (errorText) {
              errorMessage = errorText
            }
          } catch {
            // Ignore if text parsing fails
          }
        }

        console.error(`[TAS5 Export] Error response:`, errorMessage)
        throw new Error(errorMessage)
      }

      // Verify content type
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('spreadsheetml')) {
        console.warn(`[TAS5 Export] Unexpected content type: ${contentType}`)
      }

      // Get the blob
      const blob = await response.blob()
      console.log(`[TAS5 Export] Received blob: ${blob.size} bytes, type: ${blob.type}`)

      if (blob.size === 0) {
        throw new Error('Received empty file from server')
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('content-disposition')
      let filename = `TAS5_${schoolName.replace(/\s+/g, '_')}.xlsx`

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '')
        }
      }

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()

      // Cleanup
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      console.log(`[TAS5 Export] Successfully downloaded: ${filename}`)
    } catch (error: any) {
      console.error('[TAS5 Export] Export error:', error)
      setError(error.message || 'Failed to export TAS 5')
      alert(`Error exporting TAS 5: ${error.message || 'Unknown error'}`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={handleExport}
        disabled={isExporting}
        className="bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-violet-500/30"
      >
        {isExporting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <FileDown className="mr-2 h-4 w-4" />
            Export TAS 5
          </>
        )}
      </Button>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
}
