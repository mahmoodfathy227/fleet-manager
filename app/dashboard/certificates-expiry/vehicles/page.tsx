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
  entityType: 'vehicle'
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

  // Fetch Vehicles
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')

  if (vehicles) {
    vehicles.forEach((vehicle: any) => {
      const checkCertificate = (type: string, expiry: string | null) => {
        if (!expiry) return
        const daysRemaining = getDaysRemaining(expiry)
        
        if (period === 'expired' && daysRemaining < 0) {
          certificates.push({
            entityType: 'vehicle',
            entityId: vehicle.id,
            entityName: `${vehicle.make || ''} ${vehicle.model || ''}`.trim() || 'N/A',
            entityIdentifier: vehicle.registration || vehicle.vehicle_identifier || 'N/A',
            certificateType: type,
            expiryDate: expiry,
            daysRemaining,
          })
        } else if (period === '14-days' && daysRemaining >= 0 && daysRemaining <= 14) {
          certificates.push({
            entityType: 'vehicle',
            entityId: vehicle.id,
            entityName: `${vehicle.make || ''} ${vehicle.model || ''}`.trim() || 'N/A',
            entityIdentifier: vehicle.registration || vehicle.vehicle_identifier || 'N/A',
            certificateType: type,
            expiryDate: expiry,
            daysRemaining,
          })
        } else if (period === '30-days' && daysRemaining >= 0 && daysRemaining <= 30) {
          certificates.push({
            entityType: 'vehicle',
            entityId: vehicle.id,
            entityName: `${vehicle.make || ''} ${vehicle.model || ''}`.trim() || 'N/A',
            entityIdentifier: vehicle.registration || vehicle.vehicle_identifier || 'N/A',
            certificateType: type,
            expiryDate: expiry,
            daysRemaining,
          })
        }
      }

      checkCertificate('Plate Expiry', vehicle.plate_expiry_date)
      checkCertificate('Insurance', vehicle.insurance_expiry_date)
      checkCertificate('MOT', vehicle.mot_date)
      checkCertificate('Tax', vehicle.tax_date)
      checkCertificate('LOLER', vehicle.loler_expiry_date)
      checkCertificate('First Aid Kit', vehicle.first_aid_expiry)
      checkCertificate('Fire Extinguisher', vehicle.fire_extinguisher_expiry)
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
  const vehicles = certificates.filter(c => c.entityType === 'vehicle')

  return (
    <div className="space-y-6">
      {/* Vehicles Table */}
      {vehicles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-navy">
              <AlertTriangle className="mr-2 h-5 w-5" />
              Vehicles ({vehicles.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border bg-white shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Registration</TableHead>
                    <TableHead>Certificate Type</TableHead>
                    <TableHead>Expiry Date</TableHead>
                    <TableHead>Days Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((cert, idx) => (
                    <TableRow key={idx} className={getRowColorClass(cert.daysRemaining)}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/dashboard/vehicles/${cert.entityId}`}
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

export default async function VehicleCertificatesPage({
  searchParams,
}: {
  searchParams: { period?: string }
}) {
  const period = (searchParams.period as ExpiryPeriod) || '30-days'
  const counts = await getCertificateCounts()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-navy">Vehicle Certificate Expiries</h1>
        <p className="mt-2 text-sm text-gray-600">
          Track and monitor expiring certificates for vehicles
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

