import { Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { AlertTriangle, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { CertificateExpiryFilter } from '../CertificateExpiryFilter'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

type ExpiryPeriod = '30-days' | '14-days' | 'expired'

interface ExpiringCertificate {
  entityType: 'driver' | 'assistant'
  entityId: number
  entityName: string
  entityIdentifier: string
  certificateType: string
  expiryDate: string
  daysRemaining: number
}

function getDaysRemaining(expiryDate: string): number {
  const today = new Date()
  const expiry = new Date(expiryDate)
  const diffTime = expiry.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

function getRowColorClass(daysRemaining: number): string {
  if (daysRemaining < 0) return 'bg-red-50 hover:bg-red-100'
  if (daysRemaining <= 14) return 'bg-orange-50 hover:bg-orange-100'
  return 'bg-yellow-50 hover:bg-yellow-100'
}

async function getExpiringCertificates(period: ExpiryPeriod): Promise<ExpiringCertificate[]> {
  const supabase = await createClient()
  const certificates: ExpiringCertificate[] = []
  const today = new Date()
  
  let minDate: Date | null = null
  let maxDate: Date | null = null

  if (period === 'expired') {
    maxDate = today
  } else if (period === '14-days') {
    minDate = today
    maxDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
  } else if (period === '30-days') {
    minDate = today
    maxDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  }

  // Fetch Drivers
  const { data: drivers } = await supabase
    .from('drivers')
    .select(`
      employee_id,
      tas_badge_number,
      tas_badge_expiry_date,
      taxi_badge_number,
      taxi_badge_expiry_date,
      dbs_expiry_date,
      first_aid_certificate_expiry_date,
      passport_expiry_date,
      driving_license_expiry_date,
      cpc_expiry_date,
      vehicle_insurance_expiry_date,
      mot_expiry_date,
      employees!inner (
        id,
        full_name
      )
    `)

  if (drivers) {
    drivers.forEach((driver: any) => {
      const checkCertificate = (type: string, expiry: string | null) => {
        if (!expiry) return
        const daysRemaining = getDaysRemaining(expiry)
        
        if (period === 'expired' && daysRemaining < 0) {
          certificates.push({
            entityType: 'driver',
            entityId: driver.employee_id,
            entityName: driver.employees?.full_name || 'Unknown',
            entityIdentifier: driver.tas_badge_number || driver.taxi_badge_number || 'N/A',
            certificateType: type,
            expiryDate: expiry,
            daysRemaining,
          })
        } else if (period === '14-days' && daysRemaining >= 0 && daysRemaining <= 14) {
          certificates.push({
            entityType: 'driver',
            entityId: driver.employee_id,
            entityName: driver.employees?.full_name || 'Unknown',
            entityIdentifier: driver.tas_badge_number || driver.taxi_badge_number || 'N/A',
            certificateType: type,
            expiryDate: expiry,
            daysRemaining,
          })
        } else if (period === '30-days' && daysRemaining >= 0 && daysRemaining <= 30) {
          certificates.push({
            entityType: 'driver',
            entityId: driver.employee_id,
            entityName: driver.employees?.full_name || 'Unknown',
            entityIdentifier: driver.tas_badge_number || driver.taxi_badge_number || 'N/A',
            certificateType: type,
            expiryDate: expiry,
            daysRemaining,
          })
        }
      }

      checkCertificate('TAS Badge', driver.tas_badge_expiry_date)
      checkCertificate('Taxi Badge', driver.taxi_badge_expiry_date)
      checkCertificate('DBS', driver.dbs_expiry_date)
      checkCertificate('First Aid Certificate', driver.first_aid_certificate_expiry_date)
      checkCertificate('Passport', driver.passport_expiry_date)
      checkCertificate('Driving License', driver.driving_license_expiry_date)
      checkCertificate('CPC', driver.cpc_expiry_date)
      checkCertificate('Vehicle Insurance', driver.vehicle_insurance_expiry_date)
      checkCertificate('MOT', driver.mot_expiry_date)
    })
  }

  // Fetch Passenger Assistants
  const { data: assistants } = await supabase
    .from('passenger_assistants')
    .select(`
      id,
      employee_id,
      tas_badge_number,
      tas_badge_expiry_date,
      dbs_expiry_date,
      employees!inner (
        id,
        full_name
      )
    `)

  if (assistants) {
    assistants.forEach((assistant: any) => {
      const checkCertificate = (type: string, expiry: string | null) => {
        if (!expiry) return
        const daysRemaining = getDaysRemaining(expiry)
        
        if (period === 'expired' && daysRemaining < 0) {
          certificates.push({
            entityType: 'assistant',
            entityId: assistant.id,
            entityName: assistant.employees?.full_name || 'Unknown',
            entityIdentifier: assistant.tas_badge_number || 'N/A',
            certificateType: type,
            expiryDate: expiry,
            daysRemaining,
          })
        } else if (period === '14-days' && daysRemaining >= 0 && daysRemaining <= 14) {
          certificates.push({
            entityType: 'assistant',
            entityId: assistant.id,
            entityName: assistant.employees?.full_name || 'Unknown',
            entityIdentifier: assistant.tas_badge_number || 'N/A',
            certificateType: type,
            expiryDate: expiry,
            daysRemaining,
          })
        } else if (period === '30-days' && daysRemaining >= 0 && daysRemaining <= 30) {
          certificates.push({
            entityType: 'assistant',
            entityId: assistant.id,
            entityName: assistant.employees?.full_name || 'Unknown',
            entityIdentifier: assistant.tas_badge_number || 'N/A',
            certificateType: type,
            expiryDate: expiry,
            daysRemaining,
          })
        }
      }

      checkCertificate('TAS Badge', assistant.tas_badge_expiry_date)
      checkCertificate('DBS', assistant.dbs_expiry_date)
    })
  }

  // Sort by days remaining (ascending)
  certificates.sort((a, b) => a.daysRemaining - b.daysRemaining)

  return certificates
}

async function getCertificateCounts() {
  const expired = await getExpiringCertificates('expired')
  const fourteenDay = await getExpiringCertificates('14-days')
  const thirtyDay = await getExpiringCertificates('30-days')

  return {
    'expired': expired.length,
    '14-days': fourteenDay.length,
    '30-days': thirtyDay.length,
  }
}

async function CertificatesTable({ period }: { period: ExpiryPeriod }) {
  const certificates = await getExpiringCertificates(period)

  // Group by entity type
  const drivers = certificates.filter(c => c.entityType === 'driver')
  const assistants = certificates.filter(c => c.entityType === 'assistant')

  return (
    <div className="space-y-6">
      {/* Drivers Table */}
      {drivers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-navy">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Drivers ({drivers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border bg-white shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver Name</TableHead>
                    <TableHead>Badge Number</TableHead>
                    <TableHead>Certificate Type</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Days Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((cert, idx) => (
                    <TableRow key={idx} className={getRowColorClass(cert.daysRemaining)}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/employees/${cert.entityId}`}
                          prefetch={true}
                          className="text-navy hover:underline"
                        >
                          {cert.entityName}
                        </Link>
                      </TableCell>
                      <TableCell>{cert.entityIdentifier}</TableCell>
                      <TableCell>{cert.certificateType}</TableCell>
                      <TableCell>{formatDate(cert.expiryDate)}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            cert.daysRemaining < 0
                              ? 'bg-red-100 text-red-800'
                              : cert.daysRemaining <= 14
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {cert.daysRemaining < 0 ? `${Math.abs(cert.daysRemaining)} days overdue` : `${cert.daysRemaining} days`}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passenger Assistants Table */}
      {assistants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-navy">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Passenger Assistants ({assistants.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border bg-white shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Badge Number</TableHead>
                    <TableHead>Certificate Type</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Days Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assistants.map((cert, idx) => (
                    <TableRow key={idx} className={getRowColorClass(cert.daysRemaining)}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/assistants/${cert.entityId}`}
                          prefetch={true}
                          className="text-navy hover:underline"
                        >
                          {cert.entityName}
                        </Link>
                      </TableCell>
                      <TableCell>{cert.entityIdentifier}</TableCell>
                      <TableCell>{cert.certificateType}</TableCell>
                      <TableCell>{formatDate(cert.expiryDate)}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            cert.daysRemaining < 0
                              ? 'bg-red-100 text-red-800'
                              : cert.daysRemaining <= 14
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {cert.daysRemaining < 0 ? `${Math.abs(cert.daysRemaining)} days overdue` : `${cert.daysRemaining} days`}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {certificates.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">No certificates in this category</h3>
            <p className="mt-2 text-sm text-gray-500">
              {period === 'expired' && 'No expired certificates found.'}
              {period === '14-days' && 'No certificates expiring within 14 days.'}
              {period === '30-days' && 'No certificates expiring within 30 days.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default async function EmployeeCertificatesPage({
  searchParams,
}: {
  searchParams: { period?: string }
}) {
  const period = (searchParams.period as ExpiryPeriod) || '30-days'
  const counts = await getCertificateCounts()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-navy">Employee Certificate Expiries</h1>
        <p className="mt-2 text-sm text-gray-600">
          Track and monitor expiring certificates for drivers and passenger assistants
        </p>
      </div>

      {/* Period Filter Tabs - wrapped in Suspense for useSearchParams */}
      <Suspense fallback={<div className="h-10 w-full max-w-md rounded-lg bg-slate-100 animate-pulse" />}>
        <CertificateExpiryFilter currentPeriod={period} counts={counts} />
      </Suspense>

      {/* Tables */}
      <Suspense key={period} fallback={<TableSkeleton rows={5} columns={5} />}>
        <CertificatesTable period={period} />
      </Suspense>
    </div>
  )
}

