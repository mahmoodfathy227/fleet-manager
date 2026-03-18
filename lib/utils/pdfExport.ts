/**
 * Export incidents and documents to PDF
 * Uses browser's print functionality to generate PDF
 */

interface PDFExportOptions {
  title: string
  incidents?: Array<{
    id: number
    incident_type: string | null
    description: string | null
    reported_at: string
    resolved: boolean
    reference_number: string | null
  }>
  documents?: Array<{
    id: number
    doc_type: string
    file_name: string
    uploaded_at: string
    file_url: string
  }>
  routeInfo?: {
    route_number: string | null
    session_date: string
    session_type: string
    driver_name: string
    passenger_assistant_name: string
  }
}

export async function exportToPDF(options: PDFExportOptions): Promise<void> {
  const { title, incidents = [], documents = [], routeInfo } = options

  // Create a temporary div with the content to print
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Please allow pop-ups to export PDF')
    return
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @media print {
            @page {
              margin: 1cm;
            }
          }
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            color: #000;
          }
          .header {
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .header h1 {
            color: #1e3a8a;
            margin: 0;
            font-size: 24px;
          }
          .header .meta {
            color: #666;
            font-size: 12px;
            margin-top: 5px;
          }
          .section {
            margin-bottom: 30px;
          }
          .section-title {
            font-size: 18px;
            font-weight: bold;
            color: #1e3a8a;
            margin-bottom: 10px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 5px;
          }
          .incident-item, .document-item {
            margin-bottom: 15px;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: #f9f9f9;
          }
          .incident-header, .document-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
          }
          .incident-type {
            font-weight: bold;
            font-size: 14px;
            color: #1e3a8a;
          }
          .reference-number {
            background: #fee2e2;
            color: #991b1b;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
          }
          .status-badge {
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: bold;
          }
          .status-resolved {
            background: #d1fae5;
            color: #065f46;
          }
          .status-open {
            background: #fee2e2;
            color: #991b1b;
          }
          .description {
            color: #333;
            font-size: 12px;
            margin-top: 5px;
            line-height: 1.5;
          }
          .date {
            color: #666;
            font-size: 11px;
            margin-top: 5px;
          }
          .document-type {
            font-weight: bold;
            color: #1e3a8a;
            font-size: 14px;
          }
          .document-name {
            color: #333;
            font-size: 12px;
            margin-top: 3px;
          }
          .no-data {
            color: #999;
            font-style: italic;
            text-align: center;
            padding: 20px;
          }
          .footer {
            margin-top: 40px;
            padding-top: 10px;
            border-top: 1px solid #ddd;
            font-size: 10px;
            color: #666;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${title}</h1>
          ${routeInfo ? `
            <div class="meta">
              <strong>Route:</strong> ${routeInfo.route_number || 'N/A'} | 
              <strong>Date:</strong> ${new Date(routeInfo.session_date).toLocaleDateString('en-GB')} | 
              <strong>Session:</strong> ${routeInfo.session_type}<br>
              <strong>Driver:</strong> ${routeInfo.driver_name} | 
              <strong>PA:</strong> ${routeInfo.passenger_assistant_name}
            </div>
          ` : ''}
          <div class="meta">
            Generated: ${new Date().toLocaleString('en-GB')}
          </div>
        </div>

        ${incidents.length > 0 ? `
          <div class="section">
            <div class="section-title">Incidents (${incidents.length})</div>
            ${incidents.map(incident => `
              <div class="incident-item">
                <div class="incident-header">
                  <div>
                    <span class="incident-type">${incident.incident_type || 'Incident'}</span>
                    ${incident.reference_number ? `<span class="reference-number">${incident.reference_number}</span>` : ''}
                  </div>
                  <span class="status-badge ${incident.resolved ? 'status-resolved' : 'status-open'}">
                    ${incident.resolved ? 'Resolved' : 'Open'}
                  </span>
                </div>
                ${incident.description ? `<div class="description">${incident.description}</div>` : ''}
                <div class="date">
                    Reported: ${new Date(incident.reported_at).toLocaleString('en-GB')}
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${documents.length > 0 ? `
          <div class="section">
            <div class="section-title">Documents (${documents.length})</div>
            ${documents.map(doc => {
              let fileUrls: string[] = []
              try {
                const parsed = JSON.parse(doc.file_url)
                fileUrls = Array.isArray(parsed) ? parsed : [doc.file_url]
              } catch {
                fileUrls = [doc.file_url]
              }
              return `
                <div class="document-item">
                  <div class="document-header">
                    <div>
                      <div class="document-type">${doc.doc_type}</div>
                      <div class="document-name">${doc.file_name}${fileUrls.length > 1 ? ` (${fileUrls.length} files)` : ''}</div>
                    </div>
                  </div>
                  <div class="date">
                    Uploaded: ${new Date(doc.uploaded_at).toLocaleString('en-GB')}
                  </div>
                </div>
              `
            }).join('')}
          </div>
        ` : ''}

        ${incidents.length === 0 && documents.length === 0 ? `
          <div class="no-data">No incidents or documents to display</div>
        ` : ''}

        <div class="footer">
          Fleet Manager Admin Dashboard - Confidential
        </div>
      </body>
    </html>
  `

  printWindow.document.write(htmlContent)
  printWindow.document.close()

  // Wait for content to load, then trigger print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }
}

/**
 * Export custom HTML content to PDF
 * Uses browser's print functionality to generate PDF
 */
export function exportHTMLToPDF(htmlContent: string, filename: string): void {
  // Create a temporary window with the content to print
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Please allow pop-ups to export PDF')
    return
  }

  // Set the document title for the filename
  const htmlWithTitle = htmlContent.replace(
    '<head>',
    `<head><title>${filename.replace('.pdf', '')}</title>`
  )

  printWindow.document.write(htmlWithTitle)
  printWindow.document.close()

  // Wait for content to load, then trigger print
  // Give extra time for any scripts in the HTML to execute (e.g., value injection)
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print()
    }, 1000) // Increased delay to allow DOM manipulation scripts to run
  }
}

