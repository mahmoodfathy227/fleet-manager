'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import {
  ArrowLeft, Pencil, AlertTriangle, CheckCircle, Clock, XCircle,
  FileText, GraduationCap, Download, ExternalLink, Eye, Car,
  Timer, Calendar, Shield, CreditCard, User, Phone, Mail
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { notFound } from 'next/navigation'
import { SubjectDocumentsChecklist } from '@/components/dashboard/SubjectDocumentsChecklist'
import DriverPreChecks from './DriverPreChecks'

interface Driver {
  employee_id: number
  tas_badge_number: string | null
  tas_badge_expiry_date: string | null
  taxi_badge_number: string | null
  taxi_badge_expiry_date: string | null
  dbs_number: string | null
  psv_license: boolean
  first_aid_certificate_expiry_date: string | null
  passport_expiry_date: string | null
  driving_license_expiry_date: string | null
  cpc_expiry_date: string | null
  utility_bill_date: string | null
  birth_certificate: boolean
  marriage_certificate: boolean
  photo_taken: boolean
  private_hire_badge: boolean
  paper_licence: boolean
  taxi_plate_photo: boolean
  logbook: boolean
  safeguarding_training_completed: boolean
  safeguarding_training_date: string | null
  tas_pats_training_completed: boolean
  tas_pats_training_date: string | null
  psa_training_completed: boolean
  psa_training_date: string | null
  additional_notes: string | null
  spare_driver?: boolean
  self_employed?: boolean
  employees: {
    id: number
    full_name: string
    can_work: boolean
    employment_status: string
    phone_number: string | null
    personal_email: string | null
    role: string
  }
}

interface Document {
  id: number
  file_name: string | null
  file_url: string | null
  file_type: string | null
  doc_type: string | null
  uploaded_at: string
  file_path: string | null
}

interface VehicleAssignment {
  id: number
  vehicle_id: number
  assigned_from: string | null
  assigned_to: string | null
  active: boolean
  vehicles: {
    id: number
    vehicle_identifier: string | null
    registration: string | null
    make: string | null
    model: string | null
    vehicle_type: string | null
    off_the_road: boolean | null
  } | null
}

// Helper to calculate days remaining
function getDaysRemaining(expiryDate: string | null): number | null {
  if (!expiryDate) return null
  const today = new Date()
  const expiry = new Date(expiryDate)
  const diffTime = expiry.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

// Helper to get status badge for expiry dates
function getExpiryBadge(daysRemaining: number | null) {
  if (daysRemaining === null) {
    return { icon: null, label: 'Not Set', color: 'bg-slate-100 text-slate-600' }
  }
  if (daysRemaining < 0) {
    return {
      icon: XCircle,
      label: `Expired (${Math.abs(daysRemaining)} days)`,
      color: 'bg-red-50 text-red-700 border-red-200'
    }
  }
  if (daysRemaining <= 14) {
    return {
      icon: AlertTriangle,
      label: `${daysRemaining} days left`,
      color: 'bg-amber-50 text-amber-700 border-amber-200'
    }
  }
  if (daysRemaining <= 30) {
    return {
      icon: Clock,
      label: `${daysRemaining} days left`,
      color: 'bg-yellow-50 text-yellow-700 border-yellow-200'
    }
  }
  return {
    icon: CheckCircle,
    label: `${daysRemaining} days left`,
    color: 'bg-green-50 text-green-700 border-green-200'
  }
}

export function DriverDetailClient({ id }: { id: string }) {
  const [driver, setDriver] = useState<Driver | null>(null)
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<Document[]>([])
  const [vehicleAssignments, setVehicleAssignments] = useState<VehicleAssignment[]>([])
  const [idBadgePhotoUrl, setIdBadgePhotoUrl] = useState<string | null>(null)
  const [tardinessReports, setTardinessReports] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'daily-checks'>('overview')

  useEffect(() => {
    async function fetchDriver() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('drivers')
        .select(`
          *,
          employees (
            id,
            full_name,
            can_work,
            employment_status,
            phone_number,
            personal_email,
            role
          )
        `)
        .eq('employee_id', id)
        .single()

      if (error || !data) {
        setLoading(false)
        return
      }

      setDriver(data as Driver)

      // Parallel fetch for related data
      Promise.all([
        loadDocuments(data.employee_id),
        loadVehicleAssignments(data.employee_id),
        loadTardinessReports(data.employee_id)
      ]).finally(() => setLoading(false))
    }

    fetchDriver()
  }, [id])

  const loadVehicleAssignments = async (employeeId: number) => {
    const supabase = createClient()

    // Combine vehicle assignments from both tables for robustness (simplified here for brevity)
    const { data: assignmentsData } = await supabase
      .from('vehicle_assignments')
      .select(`
        id, vehicle_id, assigned_from, assigned_to, active,
        vehicles (id, vehicle_identifier, registration, make, model, vehicle_type, off_the_road)
      `)
      .eq('employee_id', employeeId)
      .or('active.eq.true,active.is.null')
      .order('assigned_from', { ascending: false })

    if (assignmentsData) {
      // Filter out any where vehicles is null
      const validAssignments = assignmentsData
        .filter((a: any) => a.vehicles)
        .map((a: any) => ({
          ...a,
          vehicles: a.vehicles
        })) as VehicleAssignment[]
      setVehicleAssignments(validAssignments)
    }
  }

  const loadDocuments = async (employeeId: number) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('document_driver_links')
      .select('documents (id, file_name, file_url, file_type, doc_type, uploaded_at, file_path)')
      .eq('driver_employee_id', employeeId)

    const docs = (data || [])
      .map((row: any) => row.documents)
      .filter(Boolean)
      .sort((a: any, b: any) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime())

    if (docs) {
      setDocuments(docs || [])

      // Find ID Badge photo
      const idBadgeDoc = docs.find(doc => {
        const type = (doc.doc_type || '').toLowerCase()
        return type === 'id badge' || type.includes('photo') || (type.includes('badge') && type.includes('id'))
      })

      if (idBadgeDoc) {
        const urlToCheck = idBadgeDoc.file_url ? parseFileUrls(idBadgeDoc.file_url)[0] : null
        if (urlToCheck) setIdBadgePhotoUrl(urlToCheck)
        else if (idBadgeDoc.file_path) {
          const { data: { publicUrl } } = supabase.storage.from('DRIVER_DOCUMENTS').getPublicUrl(idBadgeDoc.file_path)
          setIdBadgePhotoUrl(publicUrl)
        }
      }
    }
  }

  const parseFileUrls = (fileUrl: string | null): string[] => {
    if (!fileUrl) return []
    try {
      const parsed = JSON.parse(fileUrl)
      return Array.isArray(parsed) ? parsed : [fileUrl]
    } catch { return [fileUrl] }
  }

  const loadTardinessReports = async (employeeId: number) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('tardiness_reports')
      .select('id, status, reported_at')
      .eq('driver_id', employeeId)
      .eq('status', 'pending') // Just get pending count for summary mostly

    if (data) setTardinessReports(data)
  }

  if (loading) return <div className="p-8 text-center animate-pulse">Loading driver profile...</div>
  if (!driver) return notFound()

  const employee = driver.employees
  const pendingTardiness = tardinessReports.length

  const certificates = [
    { label: 'TAS Badge', date: driver.tas_badge_expiry_date, ref: driver.tas_badge_number, important: true },
    // Removed Taxi Badge as per logic in Edit page (often redundant or tracked on vehicle) but keeping if present
    ...(driver.taxi_badge_expiry_date ? [{ label: 'Taxi Badge', date: driver.taxi_badge_expiry_date, ref: driver.taxi_badge_number }] : []),
    { label: 'DBS Check', date: null, ref: driver.dbs_number, status: driver.dbs_number ? 'Active' : 'Missing' },
    { label: 'Driving License', date: driver.driving_license_expiry_date, important: true },
    { label: 'CPC', date: driver.cpc_expiry_date },
    { label: 'First Aid', date: driver.first_aid_certificate_expiry_date },
    { label: 'Passport', date: driver.passport_expiry_date },
  ]

  const trainingStatus = [
    { label: 'Safeguarding', completed: driver.safeguarding_training_completed, date: driver.safeguarding_training_date },
    { label: 'TAS PATS', completed: driver.tas_pats_training_completed, date: driver.tas_pats_training_date },
    { label: 'PSA Training', completed: driver.psa_training_completed, date: driver.psa_training_date },
  ]

  // Status Colors
  const statusColor = employee.can_work === false ? 'bg-red-100 text-red-800' : employee.employment_status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'

  return (
    <div className="max-w-[1600px] mx-auto p-4 space-y-6">

      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/drivers">
            <Button variant="outline" size="sm" className="h-9 px-3 gap-2 text-slate-600 border-slate-300 hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="relative">
              {idBadgePhotoUrl ? (
                <img src={idBadgePhotoUrl} alt="Profile" className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm bg-slate-100" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-lg border-2 border-white shadow-sm">
                  {employee.full_name.charAt(0)}
                </div>
              )}
              <div className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-white ${employee.can_work === false ? 'bg-red-500' : 'bg-green-500'}`} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{employee.full_name}</h1>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1"><User className="h-3 w-3" /> {employee.role}</span>
                <span>•</span>
                <span>ID: {employee.id}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pendingTardiness > 0 && (
            <div className="px-3 py-1.5 bg-orange-50 text-orange-700 text-xs font-medium rounded-full border border-orange-100 flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5" />
              {pendingTardiness} Late Report{pendingTardiness !== 1 ? 's' : ''}
            </div>
          )}
          <div className={`px-3 py-1.5 text-xs font-medium rounded-full flex items-center gap-1.5 ${statusColor}`}>
            {employee.can_work === false ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
            {employee.can_work === false ? 'Cannot Work' : 'Authorized to Work'}
          </div>
          <Link href={`/dashboard/drivers/${id}/edit`}>
            <Button size="sm" variant="outline" className="h-8 text-xs">
              <Pencil className="h-3 w-3 mr-1.5" /> Edit Profile
            </Button>
          </Link>
        </div>
      </div>

      {driver.additional_notes && (
        <div className="bg-yellow-50 border border-yellow-100 text-yellow-800 px-4 py-2 rounded-lg text-sm flex items-start gap-2">
          <FileText className="h-4 w-4 mt-0.5 shrink-0" />
          <p><span className="font-semibold">Note:</span> {driver.additional_notes}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex items-center gap-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`pb-3 ${activeTab === 'overview' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`pb-3 ${activeTab === 'documents' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Documents & Certificates
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('daily-checks')}
            className={`pb-3 ${activeTab === 'daily-checks' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Daily Checks
          </button>
        </div>
      </div>

      {activeTab === 'overview' && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Column: Stats & Quick Info (4 cols) */}
        <div className="lg:col-span-4 space-y-4">

          {/* Contact Card */}
          <Card>
            <CardContent className="p-0">
              <div className="p-3 border-b bg-slate-50/50 flex justify-between items-center">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact Details</h3>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><SettingsIcon /></Button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Phone</p>
                    <p className="text-sm font-medium text-slate-900">{employee.phone_number || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Email</p>
                    <p className="text-sm font-medium text-slate-900 truncate max-w-[200px]">{employee.personal_email || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Vehicle Assignment Card */}
          <Card>
            <CardContent className="p-0">
              <div className="p-3 border-b bg-slate-50/50 flex justify-between items-center">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Vehicle</h3>
                {vehicleAssignments.length > 0 && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Active</span>}
              </div>
              <div className="p-4">
                {vehicleAssignments.length > 0 ? (
                  vehicleAssignments.map(v => (
                    <div key={v.vehicle_id} className="flex gap-3 items-start">
                      <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        <Car className="h-5 w-5" />
                      </div>
                      <div>
                        <Link href={`/dashboard/vehicles/${v.vehicle_id}`} className="text-sm font-bold text-slate-900 hover:text-blue-600 hover:underline">
                          {v.vehicles?.registration || 'Unknown Reg'}
                        </Link>
                        <p className="text-xs text-slate-500">{v.vehicles?.make} {v.vehicles?.model}</p>
                        {v.vehicles?.off_the_road && <p className="text-[10px] text-red-600 font-bold mt-1">OFF ROAD</p>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-slate-500 text-sm">
                    <Car className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    No vehicle currently assigned
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Checklists */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Requirements</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'PSV License', active: driver.psv_license },
                  { label: 'Self Employed', active: driver.self_employed === true },
                  { label: 'Photo Taken', active: driver.photo_taken },
                  { label: 'Private Badge', active: driver.private_hire_badge },
                  { label: 'Birth Cert', active: driver.birth_certificate },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center gap-2 text-xs p-2 rounded border ${item.active ? 'bg-green-50 border-green-100 text-green-800' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                    {item.active ? <CheckCircle className="h-3 w-3" /> : <div className="h-3 w-3 rounded-full border border-slate-300" />}
                    {item.label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right Column: Certificates & Training (8 cols) */}
        <div className="lg:col-span-8 space-y-4">

          {/* Critical Expiring Certificates */}
          <Card className="overflow-hidden">
            <div className="p-3 border-b bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Shield className="h-4 w-4" /> Compliance Status
              </h3>
              <Link href={`/dashboard/drivers/${id}/edit?tab=certificates`}>
                <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-700">Manage</Button>
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {certificates.map((cert, i) => {
                const days = getDaysRemaining(cert.date)
                const status = getExpiryBadge(days)

                // Don't show non-important ones if they are not set, to save space, unless they are expired? 
                // Actually show all for completeness in dense view
                if (!cert.date && !cert.ref && !cert.important && !cert.status) return null

                return (
                  <div key={i} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-700">{cert.label}</span>
                      {cert.ref && <span className="text-xs text-slate-500 font-mono">{cert.ref}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      {cert.date && (
                        <div className="text-right">
                          <p className="text-xs font-medium text-slate-900">{formatDate(cert.date)}</p>
                          <p className="text-[10px] text-slate-400">Expiry Date</p>
                        </div>
                      )}
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${status.color}`}>
                        {status.icon && <status.icon className="h-3 w-3" />}
                        {status.label}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Training Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {trainingStatus.map((t, i) => (
              <Card key={i} className={`${t.completed ? 'bg-green-50/50 border-green-100' : 'bg-slate-50 border-slate-200'}`}>
                <CardContent className="p-4 flex flex-col h-full justify-between">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700">{t.label}</span>
                    {t.completed ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 text-slate-400" />}
                  </div>
                  {t.completed ? (
                    <div className="text-xs text-green-700">
                      Completed <br /> {t.date ? formatDate(t.date) : ''}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">Not Completed</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent Uploads */}
          <Card>
            <CardContent className="p-0">
              <div className="p-3 border-b bg-slate-50/50">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recent Documents</h3>
              </div>
              <div className="p-0">
                {documents.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {documents.slice(0, 5).map(doc => (
                      <div key={doc.id} className="p-3 flex items-center justify-between hover:bg-slate-50 group">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center text-slate-400">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition-colors">
                              {doc.doc_type || 'Document'}
                            </span>
                            <span className="text-[10px] text-slate-400">{formatDate(doc.uploaded_at)}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Handle parsing of file_url array if needed */}
                          <a href={parseFileUrls(doc.file_url || doc.file_path)[0] || '#'} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><Eye className="h-3.5 w-3.5 text-slate-500" /></Button>
                          </a>
                        </div>
                      </div>
                    ))}
                    {documents.length > 5 && (
                      <div className="p-2 text-center border-t">
                        <Button variant="ghost" size="sm" className="text-xs text-blue-600 h-6">View All {documents.length} Documents</Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 text-center text-sm text-slate-400">No documents uploaded</div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
      )}

      {activeTab === 'documents' && (
        <SubjectDocumentsChecklist subjectType="driver" subjectId={driver.employee_id} />
      )}
      {activeTab === 'daily-checks' && (
        <DriverPreChecks driverId={driver.employee_id} />
      )}
    </div>
  )
}

function SettingsIcon() {
  return <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
}
