/**
 * Exports data to CSV file
 * @param filename - Name of the CSV file (without extension)
 * @param rows - Array of objects to export
 */
export function exportToCSV(filename: string, rows: any[]): void {
  if (rows.length === 0) {
    console.warn('No data to export')
    return
  }

  // Get headers from first row
  const headers = Object.keys(rows[0])
  
  // Escape CSV values (handle commas, quotes, newlines)
  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) {
      return ''
    }
    
    const stringValue = String(value)
    
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`
    }
    
    return stringValue
  }

  // Build CSV content
  const headerRow = headers.map(escapeCSV).join(',')
  const dataRows = rows.map(row => 
    headers.map(header => {
      const value = row[header]
      
      // Handle arrays (like incident_refs)
      if (Array.isArray(value)) {
        return escapeCSV(value.length > 0 ? value.join('; ') : '—')
      }
      
      // Handle dates/timestamps
      if (value instanceof Date) {
        return escapeCSV(value.toISOString())
      }
      
      return escapeCSV(value)
    }).join(',')
  )
  
  const csvContent = [headerRow, ...dataRows].join('\n')
  
  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `${filename}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

