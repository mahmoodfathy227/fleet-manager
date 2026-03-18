import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ArrowLeft, Pencil, AlertTriangle, CheckCircle, Clock, XCircle, UserCog, UserCheck, User } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { notFound } from 'next/navigation'
import nextDynamic from 'next/dynamic'

export const dynamic = 'force-dynamic'

// Dynamically import the employee detail client component (for field audit)
const EmployeeDetailClient = nextDynamic(
  () => import('./EmployeeDetailClient'),
  { ssr: false }
)

// Dynamically import the employee badge photo component
const EmployeeBadgePhoto = nextDynamic(
  () => import('./EmployeeBadgePhoto'),
  { ssr: false }
)

// Documents & Certificates (dynamic requirements from Admin > Document Requirements)
const SubjectDocumentsChecklist = nextDynamic(
  () => import('@/components/dashboard/SubjectDocumentsChecklist'),
  { ssr: false }
)

async function getEmployee(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employees')
    .select(`
      *,
      drivers (
        tas_badge_number,
        tas_badge_expiry_date,
        taxi_badge_number,
        taxi_badge_expiry_date,
        dbs_expiry_date,
        psv_license,
        self_employed,
        first_aid_certificate_expiry_date,
        passport_expiry_date,
        driving_license_expiry_date,
        cpc_expiry_date,
        utility_bill_date,
        vehicle_insurance_expiry_date,
        mot_expiry_date,
        birth_certificate,
        marriage_certificate,
        photo_taken,
        private_hire_badge,
        paper_licence,
        taxi_plate_photo,
        logbook,
        safeguarding_training_completed,
        safeguarding_training_date,
        tas_pats_training_completed,
        tas_pats_training_date,
        psa_training_completed,
        psa_training_date,
        additional_notes
      ),
      passenger_assistants (
        id,
        tas_badge_number,
        tas_badge_expiry_date,
        dbs_expiry_date
      )
    `)
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  // Strip to plain JSON so RSC payload and client props never see non-serializable values
  return JSON.parse(JSON.stringify(data)) as typeof data
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

// Helper to get status badge
function getStatusBadge(daysRemaining: number | null) {
  if (daysRemaining === null) {
    return { icon: null, label: 'Not Set', color: 'bg-slate-100 text-slate-600 border-slate-200' }
  }
  if (daysRemaining < 0) {
    return { icon: XCircle, label: `${Math.abs(daysRemaining)} days overdue`, color: 'bg-red-50 text-red-700 border-red-200' }
  }
  if (daysRemaining <= 14) {
    return { icon: AlertTriangle, label: `${daysRemaining} days remaining`, color: 'bg-amber-50 text-amber-700 border-amber-200' }
  }
  if (daysRemaining <= 30) {
    return { icon: Clock, label: `${daysRemaining} days remaining`, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' }
  }
  return { icon: CheckCircle, label: `${daysRemaining} days remaining`, color: 'bg-green-50 text-green-700 border-green-200' }
}

export default async function ViewEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let employee: Awaited<ReturnType<typeof getEmployee>>
  try {
    employee = await getEmployee(id)
  } catch {
    notFound()
  }

  if (!employee) {
    notFound()
  }

  return (
    <div className="max-w-[1600px] mx-auto p-4 space-y-6">
      {/* Header Row - match driver profile */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/employees">
            <Button variant="outline" size="sm" className="h-9 px-3 gap-2 text-slate-600 border-slate-300 hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="relative">
              <EmployeeBadgePhoto
                employeeId={employee.id}
                employeeName={employee.full_name}
                badgeNumber={
                  (employee.drivers && (Array.isArray(employee.drivers) ? employee.drivers[0]?.tas_badge_number : employee.drivers.tas_badge_number)) ||
                  (employee.passenger_assistants && (Array.isArray(employee.passenger_assistants) ? employee.passenger_assistants[0]?.tas_badge_number : employee.passenger_assistants.tas_badge_number)) ||
                  null
                }
                size="sm"
              />
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
        <div className="flex items-center gap-2 flex-wrap">
          {employee.drivers && (Array.isArray(employee.drivers) ? employee.drivers.length > 0 : employee.drivers) && (
            <Link href={`/dashboard/drivers/${employee.id}`}>
              <Button size="sm" variant="outline" className="h-8 text-xs">
                <UserCog className="h-3 w-3 mr-1.5" />
                Driver Profile
              </Button>
            </Link>
          )}
          {employee.role !== 'Coordinator' && employee.passenger_assistants && (Array.isArray(employee.passenger_assistants) ? employee.passenger_assistants.length > 0 : employee.passenger_assistants) && (
            <Link href={`/dashboard/assistants/${Array.isArray(employee.passenger_assistants) ? employee.passenger_assistants[0].id : employee.passenger_assistants.id}`}>
              <Button size="sm" variant="outline" className="h-8 text-xs">
                <UserCheck className="h-3 w-3 mr-1.5" />
                PA Profile
              </Button>
            </Link>
          )}
          <div className={`px-3 py-1.5 text-xs font-medium rounded-full flex items-center gap-1.5 ${employee.can_work === false ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
            {employee.can_work === false ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
            {employee.can_work === false ? 'Cannot Work' : 'Authorized to Work'}
          </div>
          <Link href={`/dashboard/employees/${employee.id}/edit`}>
            <Button size="sm" variant="outline" className="h-8 text-xs">
              <Pencil className="h-3 w-3 mr-1.5" /> Edit Profile
            </Button>
          </Link>
        </div>
      </div>

      {employee.can_work === false && (
        <div className="bg-yellow-50 border border-yellow-100 text-yellow-800 px-4 py-2 rounded-lg text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p><span className="font-semibold">Note:</span> This employee has expired or missing certificates and is flagged as unable to work. Renew certificates below.</p>
        </div>
      )}

      <div className="space-y-6">
      {(() => {
        const expiredCerts: Array<{ type: string; expiryDate: string; daysOverdue: number; badge?: string }> = []
        const expiringCerts: Array<{ type: string; expiryDate: string; daysRemaining: number; badge?: string }> = []

        const checkCert = (type: string, date: string | null, badge?: string) => {
          if (!date) return
          const daysRemaining = getDaysRemaining(date)
          if (daysRemaining !== null) {
            if (daysRemaining < 0) {
              expiredCerts.push({ type, expiryDate: date, daysOverdue: Math.abs(daysRemaining), badge })
            } else if (daysRemaining <= 30) {
              expiringCerts.push({ type, expiryDate: date, daysRemaining, badge })
            }
          }
        }

        // Check driver certificates (handle both array and single object)
        if (employee.drivers) {
          const driver = Array.isArray(employee.drivers) ? employee.drivers[0] : employee.drivers
          if (driver) {
            checkCert('TAS Badge', driver.tas_badge_expiry_date, driver.tas_badge_number)
            checkCert('Taxi Badge', driver.taxi_badge_expiry_date, driver.taxi_badge_number)
            checkCert('DBS', driver.dbs_expiry_date)
            checkCert('First Aid Certificate', driver.first_aid_certificate_expiry_date)
            checkCert('Passport', driver.passport_expiry_date)
            checkCert('Driving License', driver.driving_license_expiry_date)
            checkCert('CPC', driver.cpc_expiry_date)
            checkCert('Vehicle Insurance', driver.vehicle_insurance_expiry_date)
            checkCert('MOT', driver.mot_expiry_date)
          }
        }

        // Check PA certificates (handle both array and single object)
        if (employee.passenger_assistants) {
          const pa = Array.isArray(employee.passenger_assistants) ? employee.passenger_assistants[0] : employee.passenger_assistants
          if (pa) {
            checkCert('TAS Badge', pa.tas_badge_expiry_date, pa.tas_badge_number)
            checkCert('DBS', pa.dbs_expiry_date)
          }
        }

        // Debug: Log to see what we found (remove in production)
        // console.log('Expired certs:', expiredCerts.length, 'Expiring certs:', expiringCerts.length)

        if (expiredCerts.length === 0 && expiringCerts.length === 0) {
          return null
        }

        return (
          <div className="space-y-4">
            {/* Expired Certificates */}
            {expiredCerts.length > 0 && (
              <Card className="overflow-hidden">
                <div className="p-3 border-b bg-red-50/80">
                  <h3 className="text-xs font-semibold text-red-800 uppercase tracking-wider flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Expired Certificates ({expiredCerts.length})
                  </h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {expiredCerts.map((cert, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-700">{cert.type}</span>
                        {cert.badge && <span className="text-xs text-slate-500 font-mono">{cert.badge}</span>}
                        <span className="text-xs text-slate-500 mt-0.5">Expired: {formatDate(cert.expiryDate)}</span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-red-50 text-red-700 border-red-200">
                        <XCircle className="h-3 w-3" />
                        {cert.daysOverdue} days overdue
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Expiring Certificates */}
            {expiringCerts.length > 0 && (
              <Card className="overflow-hidden">
                <div className="p-3 border-b bg-amber-50/80">
                  <h3 className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Expiring Certificates ({expiringCerts.length})
                  </h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {expiringCerts.map((cert, idx) => {
                    const isCritical = cert.daysRemaining <= 14
                    return (
                      <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-700">{cert.type}</span>
                          {cert.badge && <span className="text-xs text-slate-500 font-mono">{cert.badge}</span>}
                          <span className="text-xs text-slate-500 mt-0.5">Expires: {formatDate(cert.expiryDate)}</span>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${isCritical ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                          <Clock className="h-3 w-3" />
                          {cert.daysRemaining} days remaining
                        </span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
          </div>
        )
      })()}

      {/* Employee Details with Field Audit - pass as JSON string to guarantee serializable */}
      <EmployeeDetailClient
        employeeJson={JSON.stringify({
          id: employee.id,
          full_name: employee.full_name ?? null,
          role: employee.role ?? null,
          employment_status: employee.employment_status ?? null,
          can_work: employee.can_work ?? null,
          phone_number: employee.phone_number ?? null,
          personal_email: employee.personal_email ?? null,
          address: employee.address ?? null,
          next_of_kin: employee.next_of_kin ?? null,
          date_of_birth: employee.date_of_birth ?? null,
          start_date: employee.start_date ?? null,
          end_date: employee.end_date ?? null,
          created_at: employee.created_at ?? null,
          updated_at: employee.updated_at ?? null,
        })}
        employeeId={String(employee.id)}
      />

      {/* Driver Certificates - Comprehensive View */}
      {employee.drivers && Array.isArray(employee.drivers) && employee.drivers.length > 0 && (
        <>
          {employee.drivers.map((driver: any, idx: number) => (
            <div key={idx} className="space-y-6 md:col-span-2">
              {/* All Driver Certificates with Expiry Dates */}
              <Card>
                <CardContent className="p-0">
                  <div className="p-3 border-b bg-slate-50/50">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Driver Certificates & Expiry Dates</h3>
                  </div>
                  <div className="rounded-b-lg border border-t-0 border-slate-200 overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Certificate Type</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Badge/Reference</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Expiry Date</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: 'TAS Badge', date: driver.tas_badge_expiry_date, ref: driver.tas_badge_number },
                          { label: 'Taxi Badge', date: driver.taxi_badge_expiry_date, ref: driver.taxi_badge_number },
                          { label: 'DBS Certificate', date: driver.dbs_expiry_date, ref: null },
                          { label: 'First Aid Certificate', date: driver.first_aid_certificate_expiry_date, ref: null },
                          { label: 'Passport', date: driver.passport_expiry_date, ref: null },
                          { label: 'Driving License', date: driver.driving_license_expiry_date, ref: null },
                          { label: 'CPC Certificate', date: driver.cpc_expiry_date, ref: null },
                          { label: 'Vehicle Insurance', date: driver.vehicle_insurance_expiry_date, ref: null },
                          { label: 'MOT', date: driver.mot_expiry_date, ref: null },
                          { label: 'Utility Bill', date: driver.utility_bill_date, ref: null },
                        ].map((item, itemIdx) => {
                          const daysRemaining = getDaysRemaining(item.date)
                          const badge = getStatusBadge(daysRemaining)
                          return (
                            <tr key={itemIdx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-2.5 text-sm font-medium text-slate-700">{item.label}</td>
                              <td className="px-4 py-2.5 text-sm text-slate-600">{item.ref || '—'}</td>
                              <td className="px-4 py-2.5 text-sm text-slate-900">{item.date ? formatDate(item.date) : 'Not set'}</td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
                                  {badge.icon && <badge.icon className="h-3 w-3" />}
                                  {badge.label}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-4 pt-3 space-y-2 border-t border-slate-100">
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium text-slate-700">PSV License</span>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium border ${driver.psv_license ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {driver.psv_license ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium text-slate-700">Self Employed</span>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium border ${driver.self_employed ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {driver.self_employed ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Document Checklist */}
              <Card>
                <CardContent className="p-0">
                  <div className="p-3 border-b bg-slate-50/50">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Driver Document Checklist</h3>
                  </div>
                  <div className="p-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      {[
                        { label: 'Birth Certificate', value: driver.birth_certificate },
                        { label: 'Marriage Certificate', value: driver.marriage_certificate },
                        { label: 'Photo Taken', value: driver.photo_taken },
                        { label: 'Private Hire Badge', value: driver.private_hire_badge },
                        { label: 'Paper Licence', value: driver.paper_licence },
                        { label: 'Taxi Plate Photo', value: driver.taxi_plate_photo },
                        { label: 'Logbook', value: driver.logbook },
                      ].map((item, itemIdx) => (
                        <div key={itemIdx} className="flex items-center justify-between py-2 px-3 rounded-lg border border-slate-100 bg-slate-50/30">
                          <span className="text-sm font-medium text-slate-700">{item.label}</span>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border ${item.value ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                            {item.value ? 'Yes' : 'No'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Training & Checks */}
              <Card>
                <CardContent className="p-0">
                  <div className="p-3 border-b bg-slate-50/50">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Driver Training & Compliance</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {/* Safeguarding Training */}
                    <div className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700">Safeguarding Training</h3>
                        <p className="text-xs text-slate-500">Mandatory child protection training</p>
                        {driver.safeguarding_training_date && (
                          <p className="text-xs text-slate-600 mt-0.5">Completed: {formatDate(driver.safeguarding_training_date)}</p>
                        )}
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${driver.safeguarding_training_completed ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {driver.safeguarding_training_completed ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {driver.safeguarding_training_completed ? 'Completed' : 'Not Completed'}
                      </span>
                    </div>

                    {/* TAS PATS Training */}
                    <div className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700">TAS PATS Training</h3>
                        <p className="text-xs text-slate-500">Passenger Assistant Training Scheme</p>
                        {driver.tas_pats_training_date && (
                          <p className="text-xs text-slate-600 mt-0.5">Completed: {formatDate(driver.tas_pats_training_date)}</p>
                        )}
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${driver.tas_pats_training_completed ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {driver.tas_pats_training_completed ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {driver.tas_pats_training_completed ? 'Completed' : 'Not Completed'}
                      </span>
                    </div>

                    {/* PSA Training */}
                    <div className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-700">PSA Training</h3>
                        <p className="text-xs text-slate-500">Passenger Safety & Assistance</p>
                        {driver.psa_training_date && (
                          <p className="text-xs text-slate-600 mt-0.5">Completed: {formatDate(driver.psa_training_date)}</p>
                        )}
                      </div>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${driver.psa_training_completed ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {driver.psa_training_completed ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {driver.psa_training_completed ? 'Completed' : 'Not Completed'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Notes */}
              {driver.additional_notes && (
                <Card>
                  <CardContent className="p-0">
                    <div className="p-3 border-b bg-slate-50/50">
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Driver Notes (HR Comments)</h3>
                    </div>
                    <div className="p-4">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{driver.additional_notes}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ))}
        </>
      )}

      {/* Passenger Assistant Certificates - Comprehensive View */}
      {employee.passenger_assistants && Array.isArray(employee.passenger_assistants) && employee.passenger_assistants.length > 0 && (
        <>
          {employee.passenger_assistants.map((pa: any, idx: number) => (
            <div key={idx} className="md:col-span-2 space-y-6">
              <Card>
                <CardContent className="p-0">
                  <div className="p-3 border-b bg-slate-50/50">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Passenger Assistant Certificates & Expiry Dates</h3>
                  </div>
                  <div className="rounded-b-lg border border-t-0 border-slate-200 overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Certificate Type</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Badge/Reference</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Expiry Date</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-600">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label: 'TAS Badge', date: pa.tas_badge_expiry_date, ref: pa.tas_badge_number },
                          { label: 'DBS Certificate', date: pa.dbs_expiry_date, ref: null },
                        ].map((item, itemIdx) => {
                          const daysRemaining = getDaysRemaining(item.date)
                          const badge = getStatusBadge(daysRemaining)
                          return (
                            <tr key={itemIdx} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-2.5 text-sm font-medium text-slate-700">{item.label}</td>
                              <td className="px-4 py-2.5 text-sm text-slate-600">{item.ref || '—'}</td>
                              <td className="px-4 py-2.5 text-sm text-slate-900">{item.date ? formatDate(item.date) : 'Not set'}</td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
                                  {badge.icon && <badge.icon className="h-3 w-3" />}
                                  {badge.label}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </>
      )}

      </div>

      <SubjectDocumentsChecklist subjectType="employee" subjectId={Number(employee.id)} />

    </div>
  )
}

