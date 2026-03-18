import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs/promises'

/**
 * Get all weekdays (Monday-Friday) for a given month and year
 */
function getWeekdaysInMonth(year: number, month: number): number[] {
  const weekdays: number[] = []
  const daysInMonth = new Date(year, month, 0).getDate()
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day)
    const dayOfWeek = date.getDay()
    
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      weekdays.push(day)
    }
  }
  
  return weekdays
}

/**
 * Get month name from month number
 */
function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  return months[month - 1]
}

/**
 * Generate TR1 form for a route
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const routeId = parseInt(params.id)

    if (isNaN(routeId)) {
      return NextResponse.json(
        { error: 'Invalid route ID' },
        { status: 400 }
      )
    }

    // Get year and month from query params (default to current)
    const searchParams = request.nextUrl.searchParams
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString())

    // Fetch route data with all related information
    const { data: route, error: routeError } = await supabase
      .from('routes')
      .select(`
        id,
        route_number,
        school_id,
        driver_id,
        passenger_assistant_id,
        vehicle_id,
        schools (
          id,
          name,
          ref_number
        ),
        driver:driver_id (
          employee_id,
          tas_badge_number,
          taxi_badge_number,
          employees (
            id,
            full_name
          )
        ),
        pa:passenger_assistant_id (
          employee_id,
          tas_badge_number,
          employees (
            id,
            full_name
          )
        ),
        vehicles (
          id,
          registration,
          plate_number
        )
      `)
      .eq('id', routeId)
      .single()

    if (routeError || !route) {
      return NextResponse.json(
        { error: 'Route not found' },
        { status: 404 }
      )
    }

    // Fetch passengers for this route
    const { data: passengers } = await supabase
      .from('passengers')
      .select('id, full_name')
      .eq('route_id', routeId)
      .order('full_name', { ascending: true })

    // Load the TR1 template
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'TR1.xlsx')
    
    // Check if template exists
    try {
      await fs.access(templatePath)
    } catch {
      return NextResponse.json(
        { error: 'TR1 template not found. Please place TR1.xlsx in public/templates/' },
        { status: 404 }
      )
    }

    const workbook = new ExcelJS.Workbook()
    
    try {
      await workbook.xlsx.readFile(templatePath)
      console.log(`Template loaded successfully from: ${templatePath}`)
    } catch (readError) {
      console.error('Error reading template file:', readError)
      return NextResponse.json(
        { error: `Failed to read TR1 template: ${readError instanceof Error ? readError.message : 'Unknown error'}` },
        { status: 500 }
      )
    }
    
    const worksheet = workbook.getWorksheet(1)
    if (!worksheet) {
      console.error('No worksheet found in template')
      return NextResponse.json(
        { error: 'Invalid TR1 template - no worksheet found' },
        { status: 500 }
      )
    }
    
    console.log(`Using worksheet: ${worksheet.name} (${worksheet.rowCount} rows, ${worksheet.columnCount} columns)`)

    // =========================================
    // FILL HEADER FIELDS
    // =========================================
    // Note: Update these cell references to match your actual TR1 template
    const cellLocations = {
      month: 'F3',
      school: 'AF3',
      refNumber: 'U3',
      operator: 'AU3',
      vehicleRegNo: 'K6',
      licensingBadgeNo: 'AC6',
      psvDiscVehiclePlateNo: 'AV6',
      driverName: 'O8',
      driverTasNo: 'O10',
      passengerAssistantName: 'AR8',
      passengerAssistantTasNo: 'AR10',
      dateRowNumber: 15,
      dateStartColumn: 13,
      dateCellSpacing: 2, // Number of columns to skip between dates (for merged cells)
      dateHeaderCell: 'AU41', // Cell for date header in "January 2025" format
      passengerNameColumn: 2,
      passengerStartRow: 17,
    }

    // Month
    worksheet.getCell(cellLocations.month).value = getMonthName(month)
    
    // Date header in "January 2025" format
    const dateHeader = `${getMonthName(month)} ${year}`
    worksheet.getCell(cellLocations.dateHeaderCell).value = dateHeader
    console.log(`  ✓ Date header: ${dateHeader} → Cell ${cellLocations.dateHeaderCell}`)

    // School
    const school = Array.isArray(route.schools) ? route.schools[0] : route.schools
    if (school) {
      worksheet.getCell(cellLocations.school).value = school.name
    }

    // Ref Number (School Ref Number if available, otherwise Route Number + Month/Year)
    if (school?.ref_number) {
      worksheet.getCell(cellLocations.refNumber).value = school.ref_number
    } else {
      worksheet.getCell(cellLocations.refNumber).value = 
        `${route.route_number || `Route ${routeId}`} - ${month}/${year}`
    }

    // Operator (your company name - update this)
    worksheet.getCell(cellLocations.operator).value = 'County Cars'

    // Vehicle details
    const vehicle = Array.isArray(route.vehicles) ? route.vehicles[0] : route.vehicles
    if (vehicle) {
      worksheet.getCell(cellLocations.vehicleRegNo).value = vehicle.registration || ''
      console.log(`  ✓ Vehicle Reg No: ${vehicle.registration || ''} → Cell ${cellLocations.vehicleRegNo}`)
      
      // Use plate_number for PSV disc/vehicle plate number
      const psvDiscValue = vehicle.plate_number || ''
      worksheet.getCell(cellLocations.psvDiscVehiclePlateNo).value = psvDiscValue
      console.log(`  ✓ PSV Disc / Vehicle Plate No: ${psvDiscValue || '(empty)'} → Cell ${cellLocations.psvDiscVehiclePlateNo}`)
      console.log(`    - plate_number: ${vehicle.plate_number || '(not set)'}`)
    } else {
      // Set empty value even if no vehicle to ensure cell is cleared
      worksheet.getCell(cellLocations.psvDiscVehiclePlateNo).value = ''
      console.log(`  ⚠ No vehicle found - PSV Disc / Vehicle Plate No set to empty`)
    }

    // Driver details
    const driver = Array.isArray(route.driver) ? route.driver[0] : route.driver
    const driverEmployee = driver?.employees 
      ? (Array.isArray(driver.employees) ? driver.employees[0] : driver.employees)
      : null
    if (driverEmployee) {
      worksheet.getCell(cellLocations.driverName).value = driverEmployee.full_name || ''
      console.log(`  ✓ Driver Name: ${driverEmployee.full_name || '(empty)'} → Cell ${cellLocations.driverName}`)
    } else {
      worksheet.getCell(cellLocations.driverName).value = ''
    }
    
    if (driver) {
      worksheet.getCell(cellLocations.driverTasNo).value = driver.tas_badge_number || ''
      console.log(`  ✓ Driver TAS No: ${driver.tas_badge_number || '(empty)'} → Cell ${cellLocations.driverTasNo}`)
    } else {
      worksheet.getCell(cellLocations.driverTasNo).value = ''
    }
    
    // Licensing Badge No - Use driver's taxi badge number
    const licensingBadgeNo = driver?.taxi_badge_number || ''
    worksheet.getCell(cellLocations.licensingBadgeNo).value = licensingBadgeNo
    console.log(`  ✓ Licensing Badge No: ${licensingBadgeNo || '(empty)'} → Cell ${cellLocations.licensingBadgeNo}`)
    if (driver?.taxi_badge_number) {
      console.log(`    - Using driver taxi badge: ${driver.taxi_badge_number}`)
    } else {
      console.log(`    - No taxi badge found for driver`)
    }

    // PA details
    const pa = Array.isArray(route.pa) ? route.pa[0] : route.pa
    const paEmployee = pa?.employees 
      ? (Array.isArray(pa.employees) ? pa.employees[0] : pa.employees)
      : null
    if (paEmployee) {
      worksheet.getCell(cellLocations.passengerAssistantName).value = paEmployee.full_name || ''
    }
    if (pa) {
      worksheet.getCell(cellLocations.passengerAssistantTasNo).value = pa.tas_badge_number || ''
    }

    // =========================================
    // FILL WEEKDAY DATES
    // =========================================
    const weekdays = getWeekdaysInMonth(year, month)
    weekdays.forEach((dayNumber, index) => {
      // Skip cells based on merged cell spacing (each date is in a merged cell)
      const columnIndex = cellLocations.dateStartColumn + (index * cellLocations.dateCellSpacing)
      const cell = worksheet.getCell(cellLocations.dateRowNumber, columnIndex)
      cell.value = dayNumber
      console.log(`  ✓ Day ${dayNumber} → Column ${columnIndex} (row ${cellLocations.dateRowNumber})`)
    })

    // =========================================
    // FILL PASSENGER NAMES
    // =========================================
    if (passengers && passengers.length > 0) {
      passengers.forEach((passenger, index) => {
        const rowIndex = cellLocations.passengerStartRow + index
        const cell = worksheet.getCell(rowIndex, cellLocations.passengerNameColumn)
        cell.value = passenger.full_name
      })
    }

    // =========================================
    // GENERATE FILE AND RETURN
    // =========================================
    const buffer = await workbook.xlsx.writeBuffer()
    
    // Verify buffer is not empty
    if (!buffer || buffer.byteLength === 0) {
      console.error('Generated Excel buffer is empty')
      return NextResponse.json(
        { error: 'Failed to generate Excel file - buffer is empty' },
        { status: 500 }
      )
    }
    
    // Create filename
    const filename = `TR1_${route.route_number || `Route_${routeId}`}_${getMonthName(month)}_${year}.xlsx`
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_.-]/g, '')

    console.log(`Generated TR1 file: ${filename} (${buffer.byteLength} bytes)`)

    // Return the file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.byteLength.toString(),
        'Cache-Control': 'no-cache',
      },
    })

  } catch (error) {
    console.error('Error generating TR1:', error)
    return NextResponse.json(
      { error: 'Failed to generate TR1 form' },
      { status: 500 }
    )
  }
}

