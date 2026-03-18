'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Download, Calendar, X } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { Label } from '@/components/ui/Label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

interface ExportTR1ButtonProps {
  routeId: number
}

export default function ExportTR1Button({ routeId }: ExportTR1ButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1
  
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ]

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  const handleExport = async (year: number, month: number) => {
    setIsExporting(true)
    setError(null)
    
    try {
      console.log(`[TR1 Export] Starting export for route ${routeId}, ${month}/${year}`)
      
      const apiUrl = `/api/routes/${routeId}/export-tr1?year=${year}&month=${month}`
      console.log(`[TR1 Export] Fetching: ${apiUrl}`)
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      })

      console.log(`[TR1 Export] Response status: ${response.status}`)
      console.log(`[TR1 Export] Response headers:`, {
        'content-type': response.headers.get('content-type'),
        'content-length': response.headers.get('content-length'),
        'content-disposition': response.headers.get('content-disposition'),
      })

      // Check if response is OK
      if (!response.ok) {
        const contentType = response.headers.get('content-type')
        let errorMessage = `Failed to export TR1: ${response.status} ${response.statusText}`
        
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
        
        console.error(`[TR1 Export] Error response:`, errorMessage)
        throw new Error(errorMessage)
      }

      // Verify content type
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('spreadsheetml')) {
        const text = await response.text()
        console.error('[TR1 Export] Unexpected content type:', contentType)
        console.error('[TR1 Export] Response text:', text.substring(0, 200))
        throw new Error('Server did not return an Excel file. Please check that the TR1 template exists in public/templates/TR1.xlsx')
      }

      // Get the blob
      const blob = await response.blob()
      console.log(`[TR1 Export] Blob size: ${blob.size} bytes`)
      
      // Verify blob is not empty
      if (blob.size === 0) {
        throw new Error('Exported file is empty. Please check that the TR1 template exists and contains data.')
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `TR1_Route_${routeId}_${months[month - 1].label}_${year}.xlsx`
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '')
        }
      }
      
      console.log(`[TR1 Export] Downloading file: ${filename}`)

      // Create download link
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      link.style.display = 'none'
      
      // Append to body, click, and remove
      document.body.appendChild(link)
      link.click()
      
      // Clean up
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl)
        document.body.removeChild(link)
        console.log('[TR1 Export] Download completed')
      }, 100)

      setShowDatePicker(false)
      
    } catch (error) {
      console.error('[TR1 Export] Export failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to export TR1 form'
      setError(errorMessage)
      
      // Also show alert for immediate feedback
      setTimeout(() => {
        alert(`Export Error: ${errorMessage}`)
      }, 100)
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportClick = () => {
    setShowDatePicker(true)
  }

  const handleExportFromPicker = async () => {
    await handleExport(selectedYear, selectedMonth)
  }

  return (
    <div className="relative">
      <Button
        onClick={handleExportClick}
        disabled={isExporting}
        variant="secondary"
      >
        <Download className="mr-2 h-4 w-4" />
        Export TR1
      </Button>

      {showDatePicker && (
        <Card className="absolute top-full left-0 mt-2 -ml-[150px] z-50 w-96 shadow-xl border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Export TR1 Form</CardTitle>
              <Button
                onClick={() => {
                  setShowDatePicker(false)
                  setError(null)
                }}
                variant="ghost"
                size="sm"
                disabled={isExporting}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
            
            <div>
              <Label htmlFor="export-month" className="text-sm font-medium">
                Month
              </Label>
              <Select
                id="export-month"
                value={selectedMonth.toString()}
                onChange={(e) => {
                  setSelectedMonth(parseInt(e.target.value))
                  setError(null)
                }}
                disabled={isExporting}
                className="mt-1"
              >
                {months.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="export-year" className="text-sm font-medium">
                Year
              </Label>
              <Select
                id="export-year"
                value={selectedYear.toString()}
                onChange={(e) => {
                  setSelectedYear(parseInt(e.target.value))
                  setError(null)
                }}
                disabled={isExporting}
                className="mt-1"
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={handleExportFromPicker}
                disabled={isExporting}
                className="flex-1"
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Export'}
              </Button>
              <Button
                onClick={() => {
                  setShowDatePicker(false)
                  setError(null)
                }}
                variant="secondary"
                disabled={isExporting}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
