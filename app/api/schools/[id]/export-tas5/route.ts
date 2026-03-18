import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs/promises'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function formatDateDDMMYYYY(d: Date) {
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

function formatDateCell(value: string | Date | null) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return formatDateDDMMYYYY(d)
}

function safeText(v: unknown) {
  if (v === null || v === undefined) return ''
  return String(v)
}

function safeNumber(v: unknown) {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(v)
  return Number.isFinite(n) ? n : ''
}

/** Read from RPC row - Supabase may return snake_case; support both. */
function getRowVal<T = string | number | null>(r: Record<string, unknown>, key: string): T | undefined {
  const v = r[key] ?? r[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())]
  return v as T | undefined
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const schoolId = Number(params.id)
  if (!Number.isFinite(schoolId)) {
    return NextResponse.json({ error: 'Invalid school id' }, { status: 400 })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Server misconfiguration: Supabase URL or service role key missing' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: rows, error } = await supabase.rpc('export_tas5_rows', {
    p_school_id: schoolId,
  })

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch TAS5 rows', details: error.message },
      { status: 500 }
    )
  }

  const first = rows?.[0] ?? null

  // When no routes, fetch school for a single placeholder row
  let dataToWrite: any[] = rows && rows.length > 0 ? rows : []
  if (dataToWrite.length === 0) {
    const { data: school } = await supabase
      .from('schools')
      .select('ref_number, name')
      .eq('id', schoolId)
      .maybeSingle()
    dataToWrite = [
      {
        school_fps: school?.ref_number ?? '',
        school_name: school?.name ?? '',
      },
    ]
  }

  const templatePath = path.join(process.cwd(), 'public', 'templates', 'TAS 5.xlsx')
  try {
    await fs.access(templatePath)
  } catch {
    return NextResponse.json(
      { error: 'TAS 5 template not found. Ensure TAS 5.xlsx is in public/templates/' },
      { status: 404 }
    )
  }

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(templatePath)

  const worksheet =
    workbook.getWorksheet('TAS5') ||
    workbook.getWorksheet('Sheet1') ||
    workbook.worksheets[0]

  if (!worksheet) {
    return NextResponse.json({ error: 'Worksheet not found' }, { status: 500 })
  }

  const startRow = 7

  dataToWrite.forEach((r: Record<string, unknown>, index: number) => {
    const rowIndex = startRow + index

    worksheet.getCell(rowIndex, 1).value = safeText(getRowVal(r, 'school_fps'))
    worksheet.getCell(rowIndex, 2).value = safeText(getRowVal(r, 'school_name'))
    // Column 3: empty
    worksheet.getCell(rowIndex, 4).value = safeNumber(getRowVal(r, 'vehicle_id'))
    worksheet.getCell(rowIndex, 5).value = safeText(getRowVal(r, 'vehicle_registration'))
    worksheet.getCell(rowIndex, 6).value = safeText(getRowVal(r, 'vehicle_type'))
    worksheet.getCell(rowIndex, 7).value = safeText(getRowVal(r, 'operating_type'))
    worksheet.getCell(rowIndex, 8).value = safeText(getRowVal(r, 'plate_number'))
    worksheet.getCell(rowIndex, 9).value = formatDateCell(getRowVal(r, 'plate_expiry_date') as string | Date | null)
    worksheet.getCell(rowIndex, 10).value = safeNumber(getRowVal(r, 'licensed_capacity'))
    const makeModel = [safeText(getRowVal(r, 'make')), safeText(getRowVal(r, 'model'))].filter(Boolean).join(' ').trim()
    worksheet.getCell(rowIndex, 11).value = makeModel
    worksheet.getCell(rowIndex, 12).value = safeText(getRowVal(r, 'driver_name'))
    worksheet.getCell(rowIndex, 13).value = safeText(getRowVal(r, 'driver_tas'))
    worksheet.getCell(rowIndex, 14).value = formatDateCell(getRowVal(r, 'driver_tas_expiry') as string | Date | null)
    worksheet.getCell(rowIndex, 15).value = safeText(getRowVal(r, 'pa_name'))
    worksheet.getCell(rowIndex, 16).value = safeText(getRowVal(r, 'pa_tas'))
    worksheet.getCell(rowIndex, 17).value = formatDateCell(getRowVal(r, 'pa_tas_expiry') as string | Date | null)
  })

  const buffer = await workbook.xlsx.writeBuffer()

  const schoolNameForFile = first?.school_name ?? dataToWrite[0]?.school_name ?? 'School'
  const safeSchoolName = schoolNameForFile
    .replace(/[^\w\- ]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60)

  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  const fileName = `TAS5_${safeSchoolName}_${y}-${m}-${d}.xlsx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
