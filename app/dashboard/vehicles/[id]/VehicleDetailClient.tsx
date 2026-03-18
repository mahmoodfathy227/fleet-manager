'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import {
  ArrowLeft,
  Pencil,
  Car,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Shield,
  FileText,
  LayoutGrid,
  Wrench,
} from 'lucide-react'
import VehicleUpdates from './VehicleUpdates'
import VehicleDocuments from './VehicleDocuments'
import VehicleLogbook from './VehicleLogbook'
import VehicleComplianceDocuments from './VehicleComplianceDocuments'
import VehiclePreChecks from './VehiclePreChecks'
import VORToggleButton from './VORToggleButton'
import { VehicleSeatingPlan } from '@/lib/types'
import { SubjectDocumentsChecklist } from '@/components/dashboard/SubjectDocumentsChecklist'

type TabType = 'overview' | 'compliance' | 'certificates' | 'documents' | 'daily-checks'

interface VehicleDetailClientProps {
  vehicle: any
  vehicleId: number
}

interface FieldAuditInfo {
  field_name: string
  change_time: string
  action: string
  changed_by: string
  changed_by_name: string
}

function getDaysRemaining(expiryDate: string | null): number | null {
  if (!expiryDate) return null
  const today = new Date()
  const expiry = new Date(expiryDate)
  const diffTime = expiry.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

function getExpiryBadge(daysRemaining: number | null) {
  if (daysRemaining === null) {
    return { icon: null, label: 'Not Set', color: 'bg-slate-100 text-slate-600' }
  }
  if (daysRemaining < 0) {
    return {
      icon: XCircle,
      label: `Expired (${Math.abs(daysRemaining)} days)`,
      color: 'bg-red-50 text-red-700 border-red-200',
    }
  }
  if (daysRemaining <= 14) {
    return {
      icon: AlertTriangle,
      label: `${daysRemaining} days left`,
      color: 'bg-amber-50 text-amber-700 border-amber-200',
    }
  }
  if (daysRemaining <= 30) {
    return {
      icon: Clock,
      label: `${daysRemaining} days left`,
      color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    }
  }
  return {
    icon: CheckCircle,
    label: `${daysRemaining} days left`,
    color: 'bg-green-50 text-green-700 border-green-200',
  }
}

export default function VehicleDetailClient({ vehicle, vehicleId }: VehicleDetailClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [fieldAudit, setFieldAudit] = useState<Record<string, FieldAuditInfo>>({})
  const [seatingPlan, setSeatingPlan] = useState<VehicleSeatingPlan | null>(null)
  const [loadingSeating, setLoadingSeating] = useState(true)
  const [routes, setRoutes] = useState<any[]>([])
  const [loadingRoutes, setLoadingRoutes] = useState(true)

  useEffect(() => {
    async function fetchFieldAudit() {
      try {
        const response = await fetch(`/api/vehicles/${vehicleId}/field-audit`)
        if (response.ok) {
          const data = await response.json()
          setFieldAudit(data.fieldHistory || {})
        }
      } catch (error) {
        console.error('Error fetching field audit:', error)
      }
    }

    async function fetchSeatingPlan() {
      try {
        const response = await fetch(`/api/vehicles/${vehicleId}/seating-plan`)
        const data = await response.json().catch(() => ({ seatingPlan: null }))
        setSeatingPlan(data?.seatingPlan ?? null)
      } catch (error) {
        console.error('Error fetching seating plan:', error)
        setSeatingPlan(null)
      } finally {
        setLoadingSeating(false)
      }
    }

    async function fetchRoutes() {
      try {
        const response = await fetch(`/api/vehicles/${vehicleId}/routes`)
        if (response.ok) {
          const data = await response.json()
          setRoutes(data.routes || [])
        }
      } catch (error) {
        console.error('Error fetching routes:', error)
      } finally {
        setLoadingRoutes(false)
      }
    }

    fetchFieldAudit()
    fetchSeatingPlan()
    fetchRoutes()
  }, [vehicleId])

  const getFieldAuditInfo = (fieldName: string) => {
    return fieldAudit[fieldName]
  }

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatTime = (time: string | null): string => {
    if (!time) return 'N/A'
    if (time.includes(':')) {
      const parts = time.split(':')
      return `${parts[0]}:${parts[1]}`
    }
    return time
  }

  const FieldWithAudit = ({ fieldName, label, value, formatValue }: {
    fieldName: string
    label: string
    value: any
    formatValue?: (val: any) => string
  }) => {
    const auditInfo = getFieldAuditInfo(fieldName)
    const displayValue = formatValue ? formatValue(value) : (value ?? 'N/A')

    return (
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-slate-900">{String(displayValue)}</p>
        {auditInfo && (
          <p className="mt-0.5 text-[10px] text-slate-400">
            {auditInfo.action === 'CREATE' ? 'Created' : 'Updated'} by {auditInfo.changed_by_name} on {formatDateTime(auditInfo.change_time)}
          </p>
        )}
      </div>
    )
  }

  const statusColor = vehicle.off_the_road
    ? 'bg-red-100 text-red-800'
    : vehicle.spare_vehicle
      ? 'bg-amber-100 text-amber-800'
      : 'bg-green-100 text-green-800'
  const statusLabel = vehicle.off_the_road ? 'Off the Road' : vehicle.spare_vehicle ? 'Spare' : 'Active'

  const nextPmiDue =
    vehicle.vehicle_type === 'PSV' && vehicle.pmi_weeks && vehicle.last_pmi_date
      ? (() => {
          const d = new Date(vehicle.last_pmi_date)
          d.setDate(d.getDate() + vehicle.pmi_weeks * 7)
          return d.toISOString().slice(0, 10)
        })()
      : null

  const vehicleCertificates: Array<{ label: string; date: string | null; important?: boolean; ref?: string }> = [
    { label: 'Insurance', date: vehicle.insurance_expiry_date, important: true },
    ...(vehicle.vehicle_type === 'PHV' ? [{ label: 'MOT', date: vehicle.mot_date, important: true }] : []),
    { label: 'Tax', date: vehicle.tax_date },
    ...(vehicle.vehicle_type === 'PHV' || vehicle.tail_lift ? [{ label: 'LOLER', date: vehicle.loler_expiry_date }] : []),
    ...(nextPmiDue ? [{ label: 'PMI Due', date: nextPmiDue, important: true }] : []),
    { label: 'Registration Expiry', date: vehicle.registration_expiry_date },
    { label: 'First Aid', date: vehicle.first_aid_expiry },
    { label: 'Fire Extinguisher', date: vehicle.fire_extinguisher_expiry },
  ]

  return (
    <div className="space-y-6">
      {/* Header Row - match driver layout */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/vehicles">
            <Button variant="outline" size="sm" className="h-9 px-3 gap-2 text-slate-600 border-slate-300 hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 border-2 border-white shadow-sm">
              <Car className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {vehicle.vehicle_identifier || vehicle.registration || `Vehicle ${vehicle.id}`}
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{vehicle.registration || '—'}</span>
                <span>•</span>
                <span>{[vehicle.make, vehicle.model].filter(Boolean).join(' ') || '—'}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 text-xs font-medium rounded-full flex items-center gap-1.5 ${statusColor}`}>
            {vehicle.off_the_road ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
            {statusLabel}
          </div>
          <VORToggleButton vehicleId={vehicleId} currentVORStatus={vehicle.off_the_road || false} />
          <Link href={`/dashboard/vehicles/${vehicleId}/seating`}>
            <Button variant="outline" size="sm" className="h-8 text-xs border-slate-300">
              <LayoutGrid className="h-3 w-3 mr-1.5" /> Seating
            </Button>
          </Link>
          <Link href={`/dashboard/vehicles/${vehicleId}/edit`}>
            <Button size="sm" variant="outline" className="h-8 text-xs">
              <Pencil className="h-3 w-3 mr-1.5" /> Edit
            </Button>
          </Link>
        </div>
      </div>

      {vehicle.notes && (
        <div className="bg-yellow-50 border border-yellow-100 text-yellow-800 px-4 py-2 rounded-lg text-sm flex items-start gap-2">
          <FileText className="h-4 w-4 mt-0.5 shrink-0" />
          <p><span className="font-semibold">Note:</span> {vehicle.notes}</p>
        </div>
      )}

      {/* Tabs - above content so Daily Checks and others are visible below */}
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
            onClick={() => setActiveTab('compliance')}
            className={`pb-3 ${activeTab === 'compliance' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Compliance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('certificates')}
            className={`pb-3 ${activeTab === 'certificates' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Documents & Certificates
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`pb-3 ${activeTab === 'documents' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Documents
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

      {/* Tab content below tabs */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left column (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Basic info */}
            <Card>
              <CardContent className="p-0">
                <div className="p-3 border-b bg-slate-50/50">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Basic Information</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div><p className="text-xs text-slate-500">Vehicle ID</p><p className="text-sm font-medium text-slate-900">{vehicle.id}</p></div>
                  <FieldWithAudit fieldName="vehicle_identifier" label="Vehicle Identifier" value={vehicle.vehicle_identifier} />
                  <FieldWithAudit fieldName="registration" label="Registration" value={vehicle.registration} />
                  <FieldWithAudit fieldName="plate_number" label="Plate Number" value={vehicle.plate_number} />
                  <FieldWithAudit fieldName="make" label="Make" value={vehicle.make} />
                  <FieldWithAudit fieldName="model" label="Model" value={vehicle.model} />
                  <FieldWithAudit fieldName="colour" label="Colour" value={vehicle.colour} />
                  <FieldWithAudit fieldName="vehicle_type" label="Vehicle Type" value={vehicle.vehicle_type} />
                  <FieldWithAudit fieldName="vehicle_category" label="Vehicle Category" value={vehicle.vehicle_category} />
                  <FieldWithAudit fieldName="ownership_type" label="Ownership" value={vehicle.ownership_type} />
                  <FieldWithAudit fieldName="council_assignment" label="Council" value={vehicle.council_assignment} />
                </div>
              </CardContent>
            </Card>

            {/* Status & features */}
            <Card>
              <CardContent className="p-0">
                <div className="p-3 border-b bg-slate-50/50 flex justify-between items-center">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status & Features</h3>
                </div>
                <div className="p-4 space-y-3">
                  <FieldWithAudit fieldName="tail_lift" label="Tail Lift" value={vehicle.tail_lift} formatValue={(val) => val ? 'Yes' : 'No'} />
                  <FieldWithAudit fieldName="lpg_fuelled" label="LPG fuelled" value={vehicle.lpg_fuelled} formatValue={(val) => val ? 'Yes' : 'No'} />
                  <FieldWithAudit fieldName="spare_vehicle" label="Spare Vehicle" value={vehicle.spare_vehicle} formatValue={(val) => val ? 'Yes' : 'No'} />
                  {(() => {
                    const assignedEmployee = Array.isArray(vehicle.assigned_employee) ? vehicle.assigned_employee[0] : vehicle.assigned_employee
                    const assignedName = assignedEmployee?.full_name || (vehicle.assigned_to ? 'Unknown' : 'N/A')
                    return <FieldWithAudit fieldName="assigned_to" label="Assigned To (MOT & Service)" value={assignedName} />
                  })()}
                  {(() => {
                    const taxiHolder = Array.isArray(vehicle.taxi_licence_holder_employee) ? vehicle.taxi_licence_holder_employee[0] : vehicle.taxi_licence_holder_employee
                    const taxiHolderName = taxiHolder?.full_name || (vehicle.taxi_licence_holder_id ? 'Unknown' : 'N/A')
                    return <FieldWithAudit fieldName="taxi_licence_holder_id" label="Taxi Licence Holder" value={taxiHolderName} />
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {/* Compliance & expiry - driver-style list with badges */}
            <Card className="overflow-hidden">
              <div className="p-3 border-b bg-slate-50/50 flex justify-between items-center">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Compliance & Expiry
                </h3>
                <Link href={`/dashboard/vehicles/${vehicleId}/edit`}>
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-700">Manage</Button>
                </Link>
              </div>
              <div className="divide-y divide-slate-100">
                {vehicleCertificates.map((cert, i) => {
                  const days = getDaysRemaining(cert.date)
                  const status = getExpiryBadge(days)
                  if (!cert.date && !cert.ref) return null
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
                            <p className="text-[10px] text-slate-400">Expiry</p>
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

            {/* PMI (PSV only) - Always show for PSV vehicles */}
            {vehicle.vehicle_type === 'PSV' && (
              <Card>
                <CardContent className="p-0">
                  <div className="p-3 border-b bg-slate-50/50">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <Shield className="h-4 w-4" /> PMI
                    </h3>
                  </div>
                  <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Last PMI</p>
                      <p className="text-sm font-medium text-slate-900">
                        {vehicle.last_pmi_date ? formatDate(vehicle.last_pmi_date) : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Interval</p>
                      <p className="text-sm font-medium text-slate-900">
                        {vehicle.pmi_weeks != null ? `${vehicle.pmi_weeks} weeks` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Next PMI due</p>
                      <p className="text-sm font-medium text-slate-900">
                        {nextPmiDue ? formatDate(nextPmiDue) : '—'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Maintenance & safety - compact grid */}
            <Card>
              <CardContent className="p-0">
                <div className="p-3 border-b bg-slate-50/50">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Wrench className="h-4 w-4" /> Maintenance & Safety
                  </h3>
                </div>
                <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                  <FieldWithAudit fieldName="last_serviced" label="Last Serviced" value={vehicle.last_serviced} formatValue={formatDate} />
                  <FieldWithAudit fieldName="service_booked_day" label="Service Booked" value={vehicle.service_booked_day} formatValue={formatDate} />
                  {vehicle.vehicle_type === 'PHV' && (
                    <FieldWithAudit fieldName="mot_date" label="MOT" value={vehicle.mot_date} formatValue={formatDate} />
                  )}
                  <FieldWithAudit fieldName="first_aid_expiry" label="First Aid Expiry" value={vehicle.first_aid_expiry} formatValue={formatDate} />
                  <FieldWithAudit fieldName="fire_extinguisher_expiry" label="Fire Extinguisher" value={vehicle.fire_extinguisher_expiry} formatValue={formatDate} />
                </div>
              </CardContent>
            </Card>

            {/* Seating plan */}
            <Card>
              <CardContent className="p-0">
                <div className="p-3 border-b bg-slate-50/50 flex justify-between items-center">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Seating Plan</h3>
                  <Link href={`/dashboard/vehicles/${vehicleId}/seating`}>
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-blue-600 hover:text-blue-700">
                      {seatingPlan ? 'View/Edit' : 'Configure'}
                    </Button>
                  </Link>
                </div>
                <div className="p-4">
                  {loadingSeating ? (
                    <p className="text-sm text-slate-500">Loading...</p>
                  ) : seatingPlan ? (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><p className="text-xs text-slate-500">Plan</p><p className="font-medium text-slate-900">{seatingPlan.name}</p></div>
                      <div><p className="text-xs text-slate-500">Capacity</p><p className="font-medium text-slate-900">{seatingPlan.total_capacity} passengers</p></div>
                      <div><p className="text-xs text-slate-500">Wheelchair</p><p className="font-medium text-slate-900">{seatingPlan.wheelchair_spaces}</p></div>
                      <div><p className="text-xs text-slate-500">Rows × Seats</p><p className="font-medium text-slate-900">{seatingPlan.rows} × {seatingPlan.seats_per_row}</p></div>
                      {seatingPlan.notes && <div className="col-span-2"><p className="text-xs text-slate-500">Notes</p><p className="text-slate-700">{seatingPlan.notes}</p></div>}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-slate-500 text-sm">
                      No seating plan. <Link href={`/dashboard/vehicles/${vehicleId}/seating`} className="text-blue-600 hover:underline">Configure</Link>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Assigned routes */}
            <Card>
              <CardContent className="p-0">
                <div className="p-3 border-b bg-slate-50/50">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Routes</h3>
                </div>
                <div className="p-4">
                  {loadingRoutes ? (
                    <p className="text-sm text-slate-500">Loading...</p>
                  ) : routes.length > 0 ? (
                    <div className="space-y-3">
                      {routes.map((route) => (
                        <div key={route.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                          <Link href={`/dashboard/routes/${route.id}`} className="text-sm font-semibold text-slate-900 hover:text-primary">
                            {route.route_number || `Route ${route.id}`}
                          </Link>
                          {route.schools && <p className="text-xs text-slate-500 mt-0.5">{route.schools.name}</p>}
                          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                            <span>AM {formatTime(route.am_start_time)}</span>
                            <span>PM {formatTime(route.pm_start_time)}</span>
                            {route.pm_start_time_friday && route.pm_start_time_friday !== route.pm_start_time && (
                              <span className="font-medium">Fri PM {formatTime(route.pm_start_time_friday)}</span>
                            )}
                            {route.days_of_week && Array.isArray(route.days_of_week) && route.days_of_week.length > 0 && (
                              <span>{route.days_of_week.join(', ')}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center py-4">No routes assigned</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Vehicle updates */}
            <VehicleUpdates vehicleId={vehicleId} />
          </div>
        </div>
      )}

      {activeTab === 'compliance' && <VehicleComplianceDocuments vehicleId={vehicleId} />}
      {activeTab === 'certificates' && (
        <SubjectDocumentsChecklist subjectType="vehicle" subjectId={vehicleId} />
      )}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          <VehicleLogbook vehicleId={vehicleId} />
          <VehicleDocuments vehicleId={vehicleId} />
        </div>
      )}
      {activeTab === 'daily-checks' && <VehiclePreChecks vehicleId={vehicleId} />}
    </div>
  )
}

