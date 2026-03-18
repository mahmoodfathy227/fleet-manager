'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  Car,
  User,
  Video,
  Image as ImageIcon,
  Eye,
  Download,
  Search,
  Pencil,
  Save
} from 'lucide-react'
import { formatDate, formatDateTime } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { exportHTMLToPDF } from '@/lib/utils/pdfExport'

interface VehiclePreCheck {
  id: number
  check_date: string
  session_type: string
  completed_at: string
  lights_working: boolean
  mirrors_adjusted: boolean
  tires_condition: boolean
  body_damage: boolean
  windows_clean: boolean
  dashboard_lights: boolean
  horn_working: boolean
  wipers_working: boolean
  seatbelts_working: boolean
  interior_clean: boolean
  first_aid_kit: boolean
  fire_extinguisher: boolean
  warning_triangle: boolean
  emergency_kit: boolean
  engine_oil_level: boolean
  coolant_level: boolean
  brake_fluid: boolean
  fuel_level_adequate: boolean
  notes: string | null
  issues_found: string | null
  media_urls: Array<{ type: 'video' | 'image'; url: string; thumbnail?: string }> | null
  driver: {
    employees: {
      full_name: string
    }
  } | null
  vehicle: {
    vehicle_identifier: string | null
    registration: string | null
    plate_number: string | null
    make: string | null
    model: string | null
  } | null
  route_session: {
    routes: {
      route_number: string | null
    } | null
  } | null
}

interface VehiclePreChecksClientProps {
  initialDate: string
  initialPreChecks: VehiclePreCheck[]
}

const PRE_CHECK_LABELS: { key: keyof VehiclePreCheck; label: string }[] = [
  { key: 'lights_working', label: 'Lights Working' },
  { key: 'mirrors_adjusted', label: 'Mirrors Adjusted' },
  { key: 'tires_condition', label: 'Tires Condition' },
  { key: 'body_damage', label: 'No Body Damage' },
  { key: 'windows_clean', label: 'Windows Clean' },
  { key: 'dashboard_lights', label: 'Dashboard Lights' },
  { key: 'horn_working', label: 'Horn Working' },
  { key: 'wipers_working', label: 'Wipers Working' },
  { key: 'seatbelts_working', label: 'Seatbelts Working' },
  { key: 'interior_clean', label: 'Interior Clean' },
  { key: 'first_aid_kit', label: 'First Aid Kit' },
  { key: 'fire_extinguisher', label: 'Fire Extinguisher' },
  { key: 'warning_triangle', label: 'Warning Triangle' },
  { key: 'emergency_kit', label: 'Emergency Kit' },
  { key: 'engine_oil_level', label: 'Engine Oil Level' },
  { key: 'coolant_level', label: 'Coolant Level' },
  { key: 'brake_fluid', label: 'Brake Fluid' },
  { key: 'fuel_level_adequate', label: 'Fuel Level Adequate' },
]

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildPreCheckReportHTML(check: VehiclePreCheck): string {
  const driverName = check.driver?.employees?.full_name || 'N/A'
  const vehicleLabel = check.vehicle?.registration || check.vehicle?.vehicle_identifier || check.vehicle?.plate_number || 'N/A'
  const routeNumber = check.route_session?.routes?.route_number || 'N/A'
  const checklistRows = PRE_CHECK_LABELS.map(({ key, label }) => {
    const value = check[key]
    const pass = value === true
    return `<tr><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(label)}</td><td style="padding:6px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${pass ? '✓ Pass' : '✗ Fail'}</td></tr>`
  }).join('')
  const issuesBlock = check.issues_found
    ? `<div class="section"><div class="section-title">Issues Found</div><div class="issues-box">${escapeHtml(check.issues_found)}</div></div>`
    : ''
  const notesBlock = check.notes
    ? `<div class="section"><div class="section-title">Notes</div><div class="notes-box">${escapeHtml(check.notes)}</div></div>`
    : ''
  const mediaUrls = check.media_urls || []
  const images = mediaUrls.filter((m) => m.type === 'image')
  const videos = mediaUrls.filter((m) => m.type === 'video')
  const imagesHtml =
    images.length > 0
      ? `<div class="section"><div class="section-title">Uploaded Images (${images.length})</div><div class="media-grid">${images
          .map(
            (m) =>
              `<div class="media-item"><img src="${escapeHtml(m.url)}" alt="Attachment" class="report-img" /></div>`
          )
          .join('')}</div></div>`
      : ''
  const videosHtml =
    videos.length > 0
      ? `<div class="section"><div class="section-title">Video Attachments (${videos.length})</div><div class="videos-list">${videos
          .map(
            (m, i) =>
              `<div class="video-item">Video ${i + 1}: ${m.thumbnail ? `<img src="${escapeHtml(m.thumbnail)}" alt="Video thumbnail" class="report-thumb" /> ` : ''}<a href="${escapeHtml(m.url)}">${escapeHtml(m.url)}</a></div>`
          )
          .join('')}</div></div>`
      : ''

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @media print { @page { margin: 1.2cm; } }
    body { font-family: Arial, sans-serif; padding: 16px; color: #111; font-size: 12px; }
    .header { border-bottom: 2px solid #1e3a5f; padding-bottom: 10px; margin-bottom: 20px; }
    .header h1 { color: #1e3a5f; margin: 0; font-size: 18px; }
    .meta { color: #374151; font-size: 11px; margin-top: 8px; }
    .section { margin-bottom: 24px; break-inside: avoid; }
    .section-title { font-size: 14px; font-weight: bold; color: #1e3a5f; margin-bottom: 8px; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; }
    .issues-box { background: #fef2f2; border: 1px solid #fecaca; padding: 10px; border-radius: 6px; color: #991b1b; }
    .notes-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; color: #334155; }
    .media-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .media-item { break-inside: avoid; }
    .report-img { max-width: 100%; height: auto; max-height: 280px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 6px; }
    .report-thumb { max-width: 120px; height: auto; vertical-align: middle; margin-right: 8px; border: 1px solid #e5e7eb; }
    .videos-list { display: flex; flex-direction: column; gap: 8px; }
    .video-item { padding: 8px; background: #f8fafc; border-radius: 6px; word-break: break-all; }
    .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #6b7280; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Vehicle Pre-Check Report (Maintenance)</h1>
    <div class="meta">
      <strong>Vehicle:</strong> ${escapeHtml(vehicleLabel)} &nbsp;|&nbsp;
      <strong>Driver:</strong> ${escapeHtml(driverName)} &nbsp;|&nbsp;
      <strong>Route:</strong> ${escapeHtml(routeNumber)} &nbsp;|&nbsp;
      <strong>Session:</strong> ${escapeHtml(check.session_type)} &nbsp;|&nbsp;
      <strong>Check date:</strong> ${escapeHtml(formatDate(check.check_date))} &nbsp;|&nbsp;
      <strong>Completed:</strong> ${escapeHtml(formatDateTime(check.completed_at))}
    </div>
    <div class="meta">Generated: ${new Date().toLocaleString()}</div>
  </div>
  <div class="section">
    <div class="section-title">Check Results</div>
    <table><thead><tr><th style="text-align:left;padding:6px 12px;border-bottom:2px solid #1e3a5f;">Item</th><th style="text-align:center;padding:6px 12px;border-bottom:2px solid #1e3a5f;">Result</th></tr></thead><tbody>${checklistRows}</tbody></table>
  </div>
  ${issuesBlock}
  ${notesBlock}
  ${imagesHtml}
  ${videosHtml}
  <div class="footer">Fleet Manager – Pre-Check Report – Confidential</div>
</body>
</html>`
}

export default function VehiclePreChecksClient({
  initialDate,
  initialPreChecks
}: VehiclePreChecksClientProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [preChecks, setPreChecks] = useState<VehiclePreCheck[]>(initialPreChecks)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCheck, setSelectedCheck] = useState<VehiclePreCheck | null>(null)
  const [editingCheck, setEditingCheck] = useState<VehiclePreCheck | null>(null)
  const [saving, setSaving] = useState(false)
  const [pdfDownloading, setPdfDownloading] = useState(false)
  const [editForm, setEditForm] = useState<{
    notes: string
    issues_found: string
    lights_working: boolean
    mirrors_adjusted: boolean
    tires_condition: boolean
    body_damage: boolean
    windows_clean: boolean
    dashboard_lights: boolean
    horn_working: boolean
    wipers_working: boolean
    seatbelts_working: boolean
    interior_clean: boolean
    first_aid_kit: boolean
    fire_extinguisher: boolean
    warning_triangle: boolean
    emergency_kit: boolean
    engine_oil_level: boolean
    coolant_level: boolean
    brake_fluid: boolean
    fuel_level_adequate: boolean
  } | null>(null)

  const handleDateChange = async (date: string) => {
    setSelectedDate(date)
    setLoading(true)

    const supabase = createClient()
    const { data, error } = await supabase
      .from('vehicle_pre_checks')
      .select(`
        *,
        driver:driver_id(
          employees(full_name)
        ),
        vehicle:vehicle_id(
          vehicle_identifier,
          registration,
          plate_number,
          make,
          model
        ),
        route_session:route_session_id(
          routes(route_number)
        )
      `)
      .eq('check_date', date)
      .order('completed_at', { ascending: false })

    if (!error && data) {
      setPreChecks(data)
    }
    setLoading(false)
  }

  const filteredPreChecks = preChecks.filter(check => {
    if (!searchTerm) return true

    const searchLower = searchTerm.toLowerCase()
    const driverName = check.driver?.employees?.full_name?.toLowerCase() || ''
    const vehicleReg = check.vehicle?.registration?.toLowerCase() || ''
    const vehicleId = check.vehicle?.vehicle_identifier?.toLowerCase() || ''
    const routeNumber = check.route_session?.routes?.route_number?.toLowerCase() || ''

    return (
      driverName.includes(searchLower) ||
      vehicleReg.includes(searchLower) ||
      vehicleId.includes(searchLower) ||
      routeNumber.includes(searchLower)
    )
  })

  const startEditing = (check: VehiclePreCheck) => {
    setEditingCheck(check)
    setEditForm({
      notes: check.notes ?? '',
      issues_found: check.issues_found ?? '',
      lights_working: check.lights_working,
      mirrors_adjusted: check.mirrors_adjusted,
      tires_condition: check.tires_condition,
      body_damage: check.body_damage,
      windows_clean: check.windows_clean,
      dashboard_lights: check.dashboard_lights,
      horn_working: check.horn_working,
      wipers_working: check.wipers_working,
      seatbelts_working: check.seatbelts_working,
      interior_clean: check.interior_clean,
      first_aid_kit: check.first_aid_kit,
      fire_extinguisher: check.fire_extinguisher,
      warning_triangle: check.warning_triangle,
      emergency_kit: check.emergency_kit,
      engine_oil_level: check.engine_oil_level,
      coolant_level: check.coolant_level,
      brake_fluid: check.brake_fluid,
      fuel_level_adequate: check.fuel_level_adequate,
    })
  }

  const cancelEditing = () => {
    setEditingCheck(null)
    setEditForm(null)
  }

  const downloadPreCheckPDF = (check: VehiclePreCheck) => {
    setPdfDownloading(true)
    try {
      const html = buildPreCheckReportHTML(check)
      const vehicle = check.vehicle?.registration || check.vehicle?.vehicle_identifier || `id-${check.id}`
      const date = check.check_date.replace(/-/g, '')
      const fileName = `PreCheck_${vehicle}_${date}_${check.session_type}.pdf`
      exportHTMLToPDF(html, fileName)
    } finally {
      setPdfDownloading(false)
    }
  }

  const saveEdit = async () => {
    if (!editingCheck || !editForm) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('vehicle_pre_checks')
      .update({
        notes: editForm.notes || null,
        issues_found: editForm.issues_found || null,
        lights_working: editForm.lights_working,
        mirrors_adjusted: editForm.mirrors_adjusted,
        tires_condition: editForm.tires_condition,
        body_damage: editForm.body_damage,
        windows_clean: editForm.windows_clean,
        dashboard_lights: editForm.dashboard_lights,
        horn_working: editForm.horn_working,
        wipers_working: editForm.wipers_working,
        seatbelts_working: editForm.seatbelts_working,
        interior_clean: editForm.interior_clean,
        first_aid_kit: editForm.first_aid_kit,
        fire_extinguisher: editForm.fire_extinguisher,
        warning_triangle: editForm.warning_triangle,
        emergency_kit: editForm.emergency_kit,
        engine_oil_level: editForm.engine_oil_level,
        coolant_level: editForm.coolant_level,
        brake_fluid: editForm.brake_fluid,
        fuel_level_adequate: editForm.fuel_level_adequate,
      })
      .eq('id', editingCheck.id)

    if (!error) {
      await handleDateChange(selectedDate)
      setSelectedCheck(null)
      cancelEditing()
    }
    setSaving(false)
  }

  const getCheckStatus = (check: VehiclePreCheck) => {
    const allChecks = [
      check.lights_working,
      check.mirrors_adjusted,
      check.tires_condition,
      check.body_damage,
      check.windows_clean,
      check.dashboard_lights,
      check.horn_working,
      check.wipers_working,
      check.seatbelts_working,
      check.interior_clean,
      check.first_aid_kit,
      check.fire_extinguisher,
      check.warning_triangle,
      check.emergency_kit,
      check.engine_oil_level,
      check.coolant_level,
      check.brake_fluid,
      check.fuel_level_adequate,
    ]

    const passed = allChecks.filter(Boolean).length
    const total = allChecks.length
    const hasIssues = check.issues_found && check.issues_found.trim().length > 0

    if (passed === total && !hasIssues) {
      return { status: 'complete', label: 'All Checks Passed', color: 'bg-green-100 text-green-800' }
    }
    if (hasIssues) {
      return { status: 'issues', label: 'Issues Found', color: 'bg-red-100 text-red-800' }
    }
    return { status: 'partial', label: `${passed}/${total} Passed`, color: 'bg-yellow-100 text-yellow-800' }
  }

  return (
    <div className="space-y-6">
      {/* Date Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <Calendar className="h-5 w-5 text-gray-500" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="max-w-xs"
            />
            <div className="flex-1" />
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by driver, vehicle, or route..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pre-Checks List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-navy"></div>
          <p className="mt-2 text-gray-600">Loading pre-checks...</p>
        </div>
      ) : filteredPreChecks.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No pre-checks found for {formatDate(selectedDate)}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredPreChecks.map((check) => {
            const status = getCheckStatus(check)
            const driver = check.driver?.employees
            const vehicle = check.vehicle
            const route = check.route_session?.routes

            return (
              <Card key={check.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center space-x-4">
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          {status.label}
                        </div>
                        <span className="text-sm text-gray-500">
                          {formatDateTime(check.completed_at)}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${check.session_type === 'AM'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-primary/10 text-primary'
                          }`}>
                          {check.session_type}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">
                            <strong>Driver:</strong> {driver?.full_name || 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Car className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-600">
                            <strong>Vehicle:</strong> {vehicle?.registration || vehicle?.vehicle_identifier || 'N/A'}
                          </span>
                        </div>
                        {route?.route_number && (
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-600">
                              <strong>Route:</strong> {route.route_number}
                            </span>
                          </div>
                        )}
                        {check.media_urls && check.media_urls.length > 0 && (
                          <div className="flex items-center space-x-2">
                            <Video className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600">
                              {check.media_urls.filter(m => m.type === 'video').length} video(s)
                            </span>
                            <ImageIcon className="h-4 w-4 text-gray-400 ml-2" />
                            <span className="text-gray-600">
                              {check.media_urls.filter(m => m.type === 'image').length} photo(s)
                            </span>
                          </div>
                        )}
                      </div>

                      {check.issues_found && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start space-x-2">
                            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-red-900">Issues Found:</p>
                              <p className="text-sm text-red-700 mt-1">{check.issues_found}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {check.notes && (
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <strong>Notes:</strong> {check.notes}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        onClick={() => setSelectedCheck(check)}
                        variant="secondary"
                        size="sm"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      <Button
                        onClick={() => { setSelectedCheck(check); startEditing(check) }}
                        variant="outline"
                        size="sm"
                        className="border-primary text-primary hover:bg-primary/10"
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Detail / Edit Modal */}
      {(selectedCheck || editingCheck) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="bg-navy text-white">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">
                  {editingCheck ? 'Edit Pre-Check (Coordinator)' : 'Pre-Check Details'}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {editingCheck ? (
                    <>
                      <Button variant="secondary" size="sm" onClick={cancelEditing} disabled={saving}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={saveEdit} disabled={saving}>
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => selectedCheck && downloadPreCheckPDF(selectedCheck)}
                        disabled={pdfDownloading}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {pdfDownloading ? 'Preparing…' : 'Download PDF'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => selectedCheck && startEditing(selectedCheck)}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => { setSelectedCheck(null); cancelEditing() }}
                      >
                        Close
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {editingCheck && editForm ? (
                /* Edit form */
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Driver</p>
                      <p className="font-medium">{editingCheck.driver?.employees?.full_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Vehicle</p>
                      <p className="font-medium">
                        {editingCheck.vehicle?.registration || editingCheck.vehicle?.vehicle_identifier || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Session</p>
                      <p className="font-medium">{editingCheck.session_type} · {formatDate(editingCheck.check_date)}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Issues found</Label>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={editForm.issues_found}
                      onChange={(e) => setEditForm({ ...editForm, issues_found: e.target.value })}
                      placeholder="Any issues or problems found..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="Additional notes..."
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-3">Checklist (tick if passed)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {[
                        { key: 'lights_working', label: 'Lights Working' },
                        { key: 'mirrors_adjusted', label: 'Mirrors Adjusted' },
                        { key: 'tires_condition', label: 'Tires Condition' },
                        { key: 'body_damage', label: 'No Body Damage' },
                        { key: 'windows_clean', label: 'Windows Clean' },
                        { key: 'dashboard_lights', label: 'Dashboard Lights' },
                        { key: 'horn_working', label: 'Horn Working' },
                        { key: 'wipers_working', label: 'Wipers Working' },
                        { key: 'seatbelts_working', label: 'Seatbelts Working' },
                        { key: 'interior_clean', label: 'Interior Clean' },
                        { key: 'first_aid_kit', label: 'First Aid Kit' },
                        { key: 'fire_extinguisher', label: 'Fire Extinguisher' },
                        { key: 'warning_triangle', label: 'Warning Triangle' },
                        { key: 'emergency_kit', label: 'Emergency Kit' },
                        { key: 'engine_oil_level', label: 'Engine Oil Level' },
                        { key: 'coolant_level', label: 'Coolant Level' },
                        { key: 'brake_fluid', label: 'Brake Fluid' },
                        { key: 'fuel_level_adequate', label: 'Fuel Level Adequate' },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`edit-${key}`}
                            checked={editForm[key as keyof typeof editForm] as boolean}
                            onChange={(e) => setEditForm({ ...editForm, [key]: e.target.checked })}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <Label htmlFor={`edit-${key}`} className="text-sm font-normal cursor-pointer">{label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : selectedCheck ? (
                <>
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Driver</p>
                  <p className="font-medium">{selectedCheck.driver?.employees?.full_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Vehicle</p>
                  <p className="font-medium">
                    {selectedCheck.vehicle?.registration || selectedCheck.vehicle?.vehicle_identifier || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Route</p>
                  <p className="font-medium">{selectedCheck.route_session?.routes?.route_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Session Type</p>
                  <p className="font-medium">{selectedCheck.session_type}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Check Date</p>
                  <p className="font-medium">{formatDate(selectedCheck.check_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Completed At</p>
                  <p className="font-medium">{formatDateTime(selectedCheck.completed_at)}</p>
                </div>
              </div>

              {/* Check Results */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Check Results</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { label: 'Lights Working', value: selectedCheck.lights_working },
                    { label: 'Mirrors Adjusted', value: selectedCheck.mirrors_adjusted },
                    { label: 'Tires Condition', value: selectedCheck.tires_condition },
                    { label: 'No Body Damage', value: selectedCheck.body_damage },
                    { label: 'Windows Clean', value: selectedCheck.windows_clean },
                    { label: 'Dashboard Lights', value: selectedCheck.dashboard_lights },
                    { label: 'Horn Working', value: selectedCheck.horn_working },
                    { label: 'Wipers Working', value: selectedCheck.wipers_working },
                    { label: 'Seatbelts Working', value: selectedCheck.seatbelts_working },
                    { label: 'Interior Clean', value: selectedCheck.interior_clean },
                    { label: 'First Aid Kit', value: selectedCheck.first_aid_kit },
                    { label: 'Fire Extinguisher', value: selectedCheck.fire_extinguisher },
                    { label: 'Warning Triangle', value: selectedCheck.warning_triangle },
                    { label: 'Emergency Kit', value: selectedCheck.emergency_kit },
                    { label: 'Engine Oil Level', value: selectedCheck.engine_oil_level },
                    { label: 'Coolant Level', value: selectedCheck.coolant_level },
                    { label: 'Brake Fluid', value: selectedCheck.brake_fluid },
                    { label: 'Fuel Level', value: selectedCheck.fuel_level_adequate },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center space-x-2">
                      {item.value ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="text-sm">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Issues and Notes */}
              {selectedCheck.issues_found && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-semibold text-red-900 mb-2">Issues Found</h4>
                  <p className="text-sm text-red-700">{selectedCheck.issues_found}</p>
                </div>
              )}

              {selectedCheck.notes && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Notes</h4>
                  <p className="text-sm text-gray-700">{selectedCheck.notes}</p>
                </div>
              )}

              {/* Media */}
              {selectedCheck.media_urls && selectedCheck.media_urls.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-4">Media Attachments</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {selectedCheck.media_urls.map((media, index) => (
                      <div key={index} className="relative">
                        {media.type === 'video' ? (
                          <video
                            src={media.url}
                            controls
                            className="w-full h-48 object-cover rounded-lg border-2 border-gray-300"
                          />
                        ) : (
                          <img
                            src={media.url}
                            alt={`Photo ${index + 1}`}
                            className="w-full h-48 object-cover rounded-lg border-2 border-gray-300"
                          />
                        )}
                        <a
                          href={media.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute top-2 right-2 bg-navy text-white p-1 rounded hover:bg-navy/80"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

