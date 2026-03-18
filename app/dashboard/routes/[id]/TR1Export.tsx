'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { FileDown, Loader2, Calendar } from 'lucide-react'
import { exportHTMLToPDF } from '@/lib/utils/pdfExport'
import { formatDate } from '@/lib/utils'

interface TR1ExportProps {
  routeId: number
  routeNumber: string | null
}

export default function TR1Export({ routeId, routeNumber }: TR1ExportProps) {
  const [loading, setLoading] = useState(false)
  const [monthYear, setMonthYear] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const supabase = createClient()

  const handleExportTR1 = async () => {
    setLoading(true)

    try {
      // Parse month/year
      const [year, month] = monthYear.split('-').map(Number)
      const startDate = new Date(year, month - 1, 1)
      const endDate = new Date(year, month, 0)

      // Fetch route details with all related data
      const { data: route, error: routeError } = await supabase
        .from('routes')
        .select(`
          *,
          schools(name),
          driver:driver_id(
            tas_badge_number,
            employees(full_name)
          ),
          pa:passenger_assistant_id(
            tas_badge_number,
            employees(full_name)
          )
        `)
        .eq('id', routeId)
        .single()

      if (routeError || !route) {
        alert('Error loading route data')
        setLoading(false)
        return
      }

      // Get vehicle assigned to driver
      let vehicle = null
      if (route.driver_id) {
        const { data: vehicleAssignment } = await supabase
          .from('vehicle_assignments')
          .select('vehicle_id, vehicles(*)')
          .eq('employee_id', route.driver_id)
          .eq('active', true)
          .maybeSingle()

        if (vehicleAssignment?.vehicles) {
          vehicle = Array.isArray(vehicleAssignment.vehicles) 
            ? vehicleAssignment.vehicles[0] 
            : vehicleAssignment.vehicles
        }
      }

      // Fetch all passengers on this route
      const { data: passengers } = await supabase
        .from('passengers')
        .select('id, full_name')
        .eq('route_id', routeId)
        .order('full_name')

      // Fetch all sessions for the selected month
      const { data: sessions } = await supabase
        .from('route_sessions')
        .select(`
          id,
          session_date,
          session_type,
          driver_id,
          passenger_assistant_id,
          notes
        `)
        .eq('route_id', routeId)
        .gte('session_date', startDate.toISOString().split('T')[0])
        .lte('session_date', endDate.toISOString().split('T')[0])
        .order('session_date', { ascending: true })
        .order('session_type', { ascending: true })

      // Fetch attendance for all sessions
      const sessionIds = sessions?.map((s: any) => s.id) || []
      let attendanceMap: Record<number, Record<number, { am?: string, pm?: string }>> = {}

      // Initialize all passengers for all dates with 'X' (absent) by default
      passengers?.forEach((passenger: any) => {
        attendanceMap[passenger.id] = {}
        sessions?.forEach((session: any) => {
          const dateKey = new Date(session.session_date).getDate()
          if (!attendanceMap[passenger.id][dateKey]) {
            attendanceMap[passenger.id][dateKey] = { am: 'X', pm: 'X' }
          }
        })
      })

      if (sessionIds.length > 0) {
        const { data: attendance } = await supabase
          .from('route_passenger_attendance')
          .select('route_session_id, passenger_id, attendance_status')
          .in('route_session_id', sessionIds)

        if (attendance) {
          attendance.forEach((att: any) => {
            const session = sessions?.find((s: any) => s.id === att.route_session_id)
            if (!session) return

            if (!attendanceMap[att.passenger_id]) {
              attendanceMap[att.passenger_id] = {}
            }

            const dateKey = new Date(session.session_date).getDate()
            if (!attendanceMap[att.passenger_id][dateKey]) {
              attendanceMap[att.passenger_id][dateKey] = { am: 'X', pm: 'X' }
            }

            // Map attendance status to template symbols
            let symbol = ''
            if (att.attendance_status === 'present') symbol = '✓'
            else if (att.attendance_status === 'absent') symbol = 'X'
            else if (att.attendance_status === 'excused') symbol = 'R'
            else if (att.attendance_status === 'late') symbol = '✓' // Late is still present

            if (session.session_type === 'AM') {
              attendanceMap[att.passenger_id][dateKey].am = symbol
            } else {
              attendanceMap[att.passenger_id][dateKey].pm = symbol
            }
          })
        }
      }

      // Group sessions by date
      const sessionsByDate: Record<string, { am?: any, pm?: any }> = {}
      sessions?.forEach((session: any) => {
        const dateKey = session.session_date
        if (!sessionsByDate[dateKey]) {
          sessionsByDate[dateKey] = {}
        }
        const sessionType = session.session_type?.toLowerCase() as 'am' | 'pm'
        if (sessionType === 'am' || sessionType === 'pm') {
          sessionsByDate[dateKey][sessionType] = session
        }
      })

      // Get unique dates sorted
      const uniqueDates = Object.keys(sessionsByDate).sort()

      // Format month/year for display
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                          'July', 'August', 'September', 'October', 'November', 'December']
      const monthName = monthNames[month - 1]
      const monthYearDisplay = `${monthName} ${year}`

      // Get driver and PA info
      const driver = Array.isArray(route.driver) ? route.driver[0] : route.driver
      const pa = Array.isArray(route.pa) ? route.pa[0] : route.pa
      const driverEmployees = Array.isArray(driver?.employees) ? driver.employees[0] : driver?.employees
      const paEmployees = Array.isArray(pa?.employees) ? pa.employees[0] : pa?.employees
      const driverName = driverEmployees?.full_name || 'N/A'
      const driverTAS = driver?.tas_badge_number || 'N/A'
      const paName = paEmployees?.full_name || 'N/A'
      const paTAS = pa?.tas_badge_number || 'N/A'

      // Load the template HTML file from public folder
      let templateHTML = ''
      try {
        const templateResponse = await fetch('/TR1-template.html')
        if (templateResponse.ok) {
          templateHTML = await templateResponse.text()
          
          // Replace dynamic values in the template
          // Note: The template uses absolute positioning from PDF conversion,
          // so we'll do basic text replacements for header fields
          templateHTML = templateHTML
            .replace(/Sept2025/g, monthYearDisplay)
            .replace(/Month\/year:[^<]*/gi, `Month/year: ${monthYearDisplay}`)
        }
      } catch (error) {
        console.warn('Could not load template, using generated HTML:', error)
      }

      // Generate HTML for the TR1 form
      // If template loaded, use it; otherwise use generated HTML
      const htmlContent = templateHTML 
        ? generateTR1HTMLFromTemplate({
            templateHTML,
            monthYear: monthYearDisplay,
            routeNumber: routeNumber || `Route ${routeId}`,
            schoolName: route.schools?.name || 'N/A',
            operator: 'Fleet Management',
            vehicleReg: vehicle?.registration || vehicle?.vehicle_identifier || 'N/A',
            licensingBadge: vehicle?.plate_number || 'N/A',
            psvDisc: vehicle?.plate_number || 'N/A',
            driverName,
            paName,
            driverTAS,
            paTAS,
            passengers: passengers || [],
            dates: uniqueDates,
            attendanceMap,
            sessionsByDate,
          })
        : generateTR1HTML({
            monthYear: monthYearDisplay,
            routeNumber: routeNumber || `Route ${routeId}`,
            schoolName: route.schools?.name || 'N/A',
            operator: 'Fleet Management',
            vehicleReg: vehicle?.registration || vehicle?.vehicle_identifier || 'N/A',
            licensingBadge: vehicle?.plate_number || 'N/A',
            psvDisc: vehicle?.plate_number || 'N/A',
            driverName,
            paName,
            driverTAS,
            paTAS,
            passengers: passengers || [],
            dates: uniqueDates,
            attendanceMap,
            sessionsByDate,
          })

      // Export as PDF
      const safeRouteNumber = (routeNumber || `Route_${routeId}`).replace(/\s+/g, '_')
      const safeMonthYear = monthYearDisplay.replace(/\s+/g, '_')
      const fileName = `TR1_${safeRouteNumber}_${safeMonthYear}.pdf`
      exportHTMLToPDF(htmlContent, fileName)
    } catch (error: any) {
      console.error('Error exporting TR1:', error)
      alert('Error generating TR1 document: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center space-x-2">
      <Input
        type="month"
        value={monthYear}
        onChange={(e) => setMonthYear(e.target.value)}
        className="w-40"
      />
      <Button
        onClick={handleExportTR1}
        disabled={loading}
        variant="secondary"
        className="bg-navy text-white hover:bg-blue-800"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <FileDown className="mr-2 h-4 w-4" />
            Export TR1
          </>
        )}
      </Button>
    </div>
  )
}

function generateTR1HTMLFromTemplate(data: {
  templateHTML: string
  monthYear: string
  routeNumber: string
  schoolName: string
  operator: string
  vehicleReg: string
  licensingBadge: string
  psvDisc: string
  driverName: string
  paName: string
  driverTAS: string
  paTAS: string
  passengers: any[]
  dates: string[]
  attendanceMap: Record<number, Record<number, { am?: string, pm?: string }>>
  sessionsByDate: Record<string, { am?: any, pm?: any }>
}) {
  // The template uses absolute positioning from PDF conversion
  // We need to use DOM manipulation to inject values since the structure is complex
  let html = data.templateHTML
  
  // Replace Sept2025 in title and anywhere else
  html = html.replace(/Sept2025/g, data.monthYear)
  
  // Create a comprehensive script that will inject all values using DOM manipulation
  // This approach searches for text patterns and replaces them
  const injectionScript = `
    <script>
      (function() {
        try {
          const templateData = ${JSON.stringify({
            monthYear: data.monthYear,
            routeNumber: data.routeNumber,
            schoolName: data.schoolName,
            operator: data.operator,
            vehicleReg: data.vehicleReg,
            licensingBadge: data.licensingBadge,
            psvDisc: data.psvDisc,
            driverName: data.driverName,
            paName: data.paName,
            driverTAS: data.driverTAS,
            paTAS: data.paTAS,
            passengers: data.passengers.map(p => ({ id: p.id, name: p.full_name })),
            dates: data.dates,
            attendanceMap: data.attendanceMap
          })};
          
          function injectValues() {
            // Function to find and replace text in the DOM
            function findAndReplaceText(searchText, replaceText) {
              const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                null
              );
              
              let node;
              while (node = walker.nextNode()) {
                if (node.textContent && node.textContent.includes(searchText)) {
                  // Check if this is a label followed by empty space or placeholder
                  const parent = node.parentElement;
                  if (parent) {
                    // Replace the text content
                    node.textContent = node.textContent.replace(searchText, replaceText);
                    
                    // If there's empty space after the label, try to find and fill it
                    const nextSibling = parent.nextSibling;
                    if (nextSibling && nextSibling.nodeType === Node.TEXT_NODE && nextSibling.textContent.trim() === '') {
                      nextSibling.textContent = replaceText;
                    }
                  }
                }
              }
            }
            
            // Function to find elements by text content and replace following content
            function findElementByTextAndReplace(searchText, replaceText) {
              const allElements = document.querySelectorAll('*');
              for (let el of allElements) {
                if (el.textContent && el.textContent.includes(searchText)) {
                  // Find the parent container and look for empty divs or spans after this element
                  const parent = el.parentElement;
                  if (parent) {
                    // Try to find empty siblings or children to fill
                    const siblings = Array.from(parent.children);
                    const searchIndex = siblings.indexOf(el);
                    if (searchIndex >= 0 && searchIndex < siblings.length - 1) {
                      const nextSibling = siblings[searchIndex + 1];
                      if (nextSibling && (nextSibling.textContent.trim() === '' || nextSibling.textContent.trim() === searchText)) {
                        nextSibling.textContent = replaceText;
                      }
                    }
                  }
                }
              }
            }
            
            // Inject header values by searching for label patterns
            // Month/year
            findElementByTextAndReplace('Month/year:', templateData.monthYear);
            findAndReplaceText('Month/year:', 'Month/year: ' + templateData.monthYear);
            
            // FPS Number
            findElementByTextAndReplace('FPS Number:', templateData.routeNumber);
            findAndReplaceText('FPS Number:', 'FPS Number: ' + templateData.routeNumber);
            
            // School
            findElementByTextAndReplace('School:', templateData.schoolName);
            findAndReplaceText('School:', 'School: ' + templateData.schoolName);
            
            // Operator
            findElementByTextAndReplace('Operator:', templateData.operator);
            findAndReplaceText('Operator:', 'Operator: ' + templateData.operator);
            
            // Vehicle Reg No
            findElementByTextAndReplace('Vehicle Reg No:', templateData.vehicleReg);
            findAndReplaceText('Vehicle Reg No:', 'Vehicle Reg No: ' + templateData.vehicleReg);
            
            // Licensing Badge No
            findElementByTextAndReplace('Licensing Badge No:', templateData.licensingBadge);
            findAndReplaceText('Licensing Badge No:', 'Licensing Badge No: ' + templateData.licensingBadge);
            
            // PSV Disc / Vehicle Plate No
            findElementByTextAndReplace('PSV Disc', templateData.psvDisc);
            findElementByTextAndReplace('Vehicle Plate No:', templateData.psvDisc);
            findAndReplaceText('PSV Disc', 'PSV Disc ' + templateData.psvDisc);
            
            // Driver Name
            findElementByTextAndReplace('Driver Name:', templateData.driverName);
            findAndReplaceText('Driver Name:', 'Driver Name: ' + templateData.driverName);
            
            // Passenger Assistant Name(s)
            findElementByTextAndReplace('Passenger Assistant Name', templateData.paName);
            findAndReplaceText('Passenger Assistant Name', 'Passenger Assistant Name: ' + templateData.paName);
            
            // Driver TAS No
            findElementByTextAndReplace('Driver TAS No:', templateData.driverTAS);
            findAndReplaceText('Driver TAS No:', 'Driver TAS No: ' + templateData.driverTAS);
            
            // Passenger Assistant TAS No(s)
            findElementByTextAndReplace('Passenger Assistant TAS No', templateData.paTAS);
            findAndReplaceText('Passenger Assistant TAS No', 'Passenger Assistant TAS No: ' + templateData.paTAS);
            
            // More aggressive approach: find all divs and spans and check their text content
            const allDivs = document.querySelectorAll('div');
            allDivs.forEach(div => {
              const text = div.textContent || '';
              
              // Check for empty divs that might be placeholders
              if (text.trim() === '' && div.children.length === 0) {
                // This might be a placeholder, but we can't reliably fill it without context
              }
              
              // Check for divs containing labels
              if (text.includes('Month/year:') && !text.includes(templateData.monthYear)) {
                div.textContent = text.replace(/Month\/year:[^\\n]*/, 'Month/year: ' + templateData.monthYear);
              }
              if (text.includes('FPS Number:') && !text.includes(templateData.routeNumber)) {
                div.textContent = text.replace(/FPS Number:[^\\n]*/, 'FPS Number: ' + templateData.routeNumber);
              }
              if (text.includes('School:') && !text.includes(templateData.schoolName)) {
                div.textContent = text.replace(/School:[^\\n]*/, 'School: ' + templateData.schoolName);
              }
              if (text.includes('Operator:') && !text.includes(templateData.operator)) {
                div.textContent = text.replace(/Operator:[^\\n]*/, 'Operator: ' + templateData.operator);
              }
              if (text.includes('Vehicle Reg No:') && !text.includes(templateData.vehicleReg)) {
                div.textContent = text.replace(/Vehicle Reg No:[^\\n]*/, 'Vehicle Reg No: ' + templateData.vehicleReg);
              }
              if (text.includes('Licensing Badge No:') && !text.includes(templateData.licensingBadge)) {
                div.textContent = text.replace(/Licensing Badge No:[^\\n]*/, 'Licensing Badge No: ' + templateData.licensingBadge);
              }
              if (text.includes('Driver Name:') && !text.includes(templateData.driverName)) {
                div.textContent = text.replace(/Driver Name:[^\\n]*/, 'Driver Name: ' + templateData.driverName);
              }
              if (text.includes('Driver TAS No:') && !text.includes(templateData.driverTAS)) {
                div.textContent = text.replace(/Driver TAS No:[^\\n]*/, 'Driver TAS No: ' + templateData.driverTAS);
              }
            });
          }
          
          // Run immediately and multiple times to ensure values are injected
          function runInjection() {
            injectValues();
          }
          
          // Run immediately
          runInjection();
          
          // Wait for DOM to be ready
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', runInjection);
          }
          
          // Run multiple times with delays to ensure values are injected before print
          setTimeout(runInjection, 50);
          setTimeout(runInjection, 200);
          setTimeout(runInjection, 500);
          setTimeout(runInjection, 1000);
          setTimeout(runInjection, 2000);
        } catch (e) {
          console.error('Error injecting template values:', e);
        }
      })();
    </script>
  `
  
  // Insert the script before the closing body tag
  html = html.replace(/<\/body>/i, `${injectionScript}</body>`)
  
  return html
}

function generateTR1HTML(data: {
  monthYear: string
  routeNumber: string
  schoolName: string
  operator: string
  vehicleReg: string
  licensingBadge: string
  psvDisc: string
  driverName: string
  paName: string
  driverTAS: string
  paTAS: string
  passengers: any[]
  dates: string[]
  attendanceMap: Record<number, Record<number, { am?: string, pm?: string }>>
  sessionsByDate: Record<string, { am?: any, pm?: any }>
}) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 9pt;
      margin: 0;
      padding: 0;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    .header-table td {
      border: 1px solid #000;
      padding: 4px;
      font-size: 8pt;
    }
    .header-table .label {
      font-weight: bold;
      background-color: #f0f0f0;
      width: 120px;
    }
    .main-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7pt;
    }
    .main-table th,
    .main-table td {
      border: 1px solid #000;
      padding: 2px 4px;
      text-align: center;
    }
    .main-table th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    .main-table .passenger-name {
      text-align: left;
      font-weight: normal;
    }
    .comments-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    .comments-table th,
    .comments-table td {
      border: 1px solid #000;
      padding: 4px;
      font-size: 8pt;
    }
    .comments-table th {
      background-color: #f0f0f0;
      font-weight: bold;
    }
    .legend {
      margin: 5px 0;
      font-size: 8pt;
    }
  </style>
</head>
<body>
  <h2 style="text-align: center; margin-bottom: 10px;">Home to School Transport Record for SEN Passengers</h2>
  
  <!-- Header Information -->
  <table class="header-table">
    <tr>
      <td class="label">Month/year:</td>
      <td>${data.monthYear}</td>
      <td class="label">FPS Number:</td>
      <td>${data.routeNumber}</td>
      <td class="label">School:</td>
      <td>${data.schoolName}</td>
      <td class="label">Operator:</td>
      <td>${data.operator}</td>
    </tr>
    <tr>
      <td class="label">Vehicle Reg No:</td>
      <td>${data.vehicleReg}</td>
      <td class="label">Licensing Badge No:</td>
      <td>${data.licensingBadge}</td>
      <td class="label">PSV Disc / Vehicle Plate No:</td>
      <td>${data.psvDisc}</td>
      <td></td>
      <td></td>
    </tr>
    <tr>
      <td class="label">Driver Name:</td>
      <td>${data.driverName}</td>
      <td class="label">Passenger Assistant Name(s):</td>
      <td>${data.paName}</td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
    <tr>
      <td class="label">Driver TAS No:</td>
      <td>${data.driverTAS}</td>
      <td class="label">Passenger Assistant TAS No(s):</td>
      <td>${data.paTAS}</td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
    <tr>
      <td class="label" colspan="2"><strong>IN / OUT Journeys</strong></td>
      <td colspan="6" style="text-align: left; padding-left: 10px;">
        <span style="margin-right: 15px;">✓ Complete once passenger is on board the vehicle</span>
        <span style="margin-right: 15px;"><strong>C/O</strong> Call Out Only</span>
        <span style="margin-right: 15px;"><strong>X</strong> Not Collected</span>
        <span><strong>R</strong> Respite</span>
      </td>
    </tr>
  </table>

  <!-- Main Attendance Table -->
  <table class="main-table">
    <thead>
      <tr>
        <th style="width: 80px;">Date of journey</th>
        <th style="width: 150px;">Passenger Name</th>
        ${data.dates.map(date => {
          const dateObj = new Date(date)
          const day = dateObj.getDate()
          return `<th colspan="2" style="min-width: 40px;">${day}</th>`
        }).join('')}
      </tr>
      <tr>
        <th></th>
        <th></th>
        ${data.dates.map(() => '<th style="width: 20px;">In</th><th style="width: 20px;">Out</th>').join('')}
      </tr>
    </thead>
    <tbody>
      ${data.passengers.map((passenger) => {
        const dateCells = data.dates.map(date => {
          const dateObj = new Date(date)
          const day = dateObj.getDate()
          const amStatus = data.attendanceMap[passenger.id]?.[day]?.am || ''
          const pmStatus = data.attendanceMap[passenger.id]?.[day]?.pm || ''
          return `<td>${amStatus}</td><td>${pmStatus}</td>`
        }).join('')
        
        return `
          <tr>
            <td></td>
            <td class="passenger-name">${passenger.full_name}</td>
            ${dateCells}
          </tr>
        `
      }).join('')}
    </tbody>
  </table>

  <!-- Staff and Vehicle Sweep Section -->
  <div style="margin: 10px 0; padding: 5px; background-color: #f9f9f9; border: 1px solid #000; font-size: 8pt;">
    <strong>TO ALL EDUCATION ESTABLISHMENTS - SIGNATURE MUST NOT BE BACKDATED - ANY QUERIES REFER TO TAS</strong>
  </div>

  <table class="main-table" style="margin-bottom: 10px;">
    <thead>
      <tr>
        <th style="width: 200px;"></th>
        ${data.dates.map(date => {
          const dateObj = new Date(date)
          const day = dateObj.getDate()
          return `<th colspan="2" style="min-width: 40px;">${day}</th>`
        }).join('')}
      </tr>
      <tr>
        <th></th>
        ${data.dates.map(() => '<th style="width: 20px;">In</th><th style="width: 20px;">Out</th>').join('')}
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="text-align: left; font-weight: bold;">Times IN/OUT</td>
        ${data.dates.map(() => '<td></td><td></td>').join('')}
      </tr>
      <tr>
        <td style="text-align: left; font-size: 7pt;">
          School staff name for all journeys (p.t.o please ensure comments are completed in full to justify payments and explain if alterations have been made).
        </td>
        ${data.dates.map(() => '<td></td><td></td>').join('')}
      </tr>
      <tr>
        <td style="text-align: left; font-weight: bold;">Sweep of vehicle Driver initials</td>
        ${data.dates.map(() => '<td></td><td></td>').join('')}
      </tr>
      <tr>
        <td style="text-align: left; font-weight: bold;">Sweep of vehicle PA's initials</td>
        ${data.dates.map(() => '<td></td><td></td>').join('')}
      </tr>
    </tbody>
  </table>

  <!-- Comments Section -->
  <table class="comments-table">
    <thead>
      <tr>
        <th style="width: 15%;">Date</th>
        <th style="width: 60%;">Comments</th>
        <th style="width: 25%;">Transport / School / TAS (Staff Name)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td></td>
        <td style="font-style: italic; font-size: 7pt;">
          This space must also be used to record the details of any transport staff covering a route on a temporary basis.
        </td>
        <td></td>
      </tr>
      ${Array(20).fill(0).map(() => `
        <tr>
          <td></td>
          <td></td>
          <td></td>
        </tr>
      `).join('')}
    </tbody>
  </table>
</body>
</html>
  `
}

