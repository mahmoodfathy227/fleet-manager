'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import { usePermissions } from '@/hooks/usePermissions'
import { useRouteSpares, getEffectiveSpareForType, formatSpareBadgeText } from '@/hooks/useRouteSpares'
import { ManageSparesModal } from '@/components/routes/ManageSparesModal'
import { UserCog } from 'lucide-react'

interface FieldAuditInfo {
  field_name: string
  change_time: string
  action: string
  changed_by: string
  changed_by_name: string
}

interface RoutePasItem {
  employee_id: number
  pa_id?: number | null
  sort_order?: number
  employees?: { full_name?: string } | { full_name?: string }[]
}

interface RouteDetailClientProps {
  route: any
  routeId: number
  routePasList?: RoutePasItem[]
}

export default function RouteDetailClient({ route, routeId, routePasList }: RouteDetailClientProps) {
  const [fieldAudit, setFieldAudit] = useState<Record<string, FieldAuditInfo>>({})
  const { spares, refetch: refetchSpares } = useRouteSpares(routeId)
  const { has } = usePermissions()
  const canViewSpares = has('routes.spares.view')
  const canSetSpares = has('routes.spares.set')
  const canClearSpares = has('routes.spares.clear')
  const showManageSpares = canViewSpares && (canSetSpares || canClearSpares)
  const [sparesModalOpen, setSparesModalOpen] = useState(false)

  useEffect(() => {
    async function fetchFieldAudit() {
      try {
        const response = await fetch(`/api/routes/${routeId}/field-audit`)
        if (response.ok) {
          const data = await response.json()
          setFieldAudit(data.fieldHistory || {})
        }
      } catch (error) {
        console.error('Error fetching route field audit:', error)
      }
    }

    fetchFieldAudit()
  }, [routeId])

  const getFieldAuditInfo = (fieldName: string) => {
    return fieldAudit[fieldName]
  }

  const formatTime = (time: string | null): string => {
    if (!time) return 'N/A'
    if (time.includes(':')) {
      const parts = time.split(':')
      return `${parts[0]}:${parts[1]}`
    }
    return time
  }

  const spareDriver = getEffectiveSpareForType(spares, 'driver')
  const sparePa = getEffectiveSpareForType(spares, 'pa')
  const spareVehicle = getEffectiveSpareForType(spares, 'vehicle')

  const [spareDetails, setSpareDetails] = useState<{
    driver?: { name: string }
    pa?: { name: string; paId: number | null }
    vehicle?: { name: string }
  }>({})

  useEffect(() => {
    if (!spareDriver && !sparePa && !spareVehicle) {
      setSpareDetails({})
      return
    }
    const client = (async () => {
      const { createClient } = await import('@/lib/supabase/client')
      return createClient()
    })()
    void client.then(async (supabase) => {
      const out: { driver?: { name: string }; pa?: { name: string; paId: number | null }; vehicle?: { name: string } } = {}
      if (spareDriver?.driver_employee_id) {
        const { data } = await supabase
          .from('drivers')
          .select('employees(full_name)')
          .eq('employee_id', spareDriver.driver_employee_id)
          .maybeSingle()
        const emp = Array.isArray((data as any)?.employees) ? (data as any).employees?.[0] : (data as any)?.employees
        out.driver = { name: emp?.full_name ?? `Driver ${spareDriver.driver_employee_id}` }
      }
      if (sparePa?.pa_employee_id) {
        const { data: paData } = await supabase
          .from('passenger_assistants')
          .select('id, employees(full_name)')
          .eq('employee_id', sparePa.pa_employee_id)
          .maybeSingle()
        const emp = Array.isArray((paData as any)?.employees) ? (paData as any).employees?.[0] : (paData as any)?.employees
        out.pa = { name: emp?.full_name ?? `PA ${sparePa.pa_employee_id}`, paId: (paData as any)?.id ?? null }
      }
      if (spareVehicle?.vehicle_id) {
        const { data: vData } = await supabase
          .from('vehicles')
          .select('vehicle_identifier, registration')
          .eq('id', spareVehicle.vehicle_id)
          .maybeSingle()
        out.vehicle = { name: (vData as any)?.vehicle_identifier || (vData as any)?.registration || `Vehicle ${spareVehicle.vehicle_id}` }
      }
      setSpareDetails(out)
    })
  }, [spareDriver?.driver_employee_id, sparePa?.pa_employee_id, spareVehicle?.vehicle_id])

  const FieldWithAudit = ({
    fieldName,
    label,
    value,
    formatValue,
  }: {
    fieldName: string
    label: string
    value: any
    formatValue?: (val: any) => string
  }) => {
    const displayValue = formatValue ? formatValue(value) : (value || 'N/A')
    return (
      <div className="flex items-center justify-between py-0.5 border-b border-slate-100 last:border-0 gap-2">
        <dt className="text-xs text-slate-500 shrink-0">{label}</dt>
        <dd className="text-xs font-medium text-slate-900">{displayValue}</dd>
      </div>
    )
  }

  const CrewRow = ({
    label,
    children,
    spareBadge,
    spareLink,
  }: {
    label: string
    children: React.ReactNode
    spareBadge?: string | null
    spareLink?: { href: string; label: string } | null
  }) => (
    <div className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0 gap-2">
      <dt className="text-xs text-slate-500 shrink-0 font-medium">{label}</dt>
      <dd className="text-xs font-medium text-slate-900 text-right flex flex-wrap items-center justify-end gap-1.5">
        {children}
        {spareBadge && (
          <span className="inline-flex items-center gap-1.5 flex-wrap justify-end">
            <span
              className="inline-flex items-center rounded bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap"
              title={spareBadge}
            >
              {spareBadge}
            </span>
            {spareLink ? (
              spareLink.href !== '#' ? (
                <Link
                  href={spareLink.href}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {spareLink.label}
                </Link>
              ) : (
                <span className="text-slate-700">{spareLink.label}</span>
              )
            ) : null}
          </span>
        )}
      </dd>
    </div>
  )

  return (
    <div className="grid gap-2 md:grid-cols-2">
      <Card>
        <CardContent className="p-2.5">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5 border-b border-slate-100 pb-1">Basic Information</h2>

          <div className="flex items-center justify-between py-0.5 border-b border-slate-100 gap-2">
            <dt className="text-xs text-slate-500">Route ID</dt>
            <dd className="text-xs font-medium text-slate-900">{route.id}</dd>
          </div>

          <FieldWithAudit fieldName="route_number" label="Route Number" value={route.route_number} />

          <div className="flex items-center justify-between py-0.5 border-b border-slate-100 gap-2">
            <dt className="text-xs text-slate-500">School</dt>
            <dd className="text-xs font-medium text-slate-900">
              {route.schools ? (
                <Link href={`/dashboard/schools/${route.school_id}`} className="text-blue-600 hover:underline">
                  {route.schools.name}
                </Link>
              ) : (
                'N/A'
              )}
            </dd>
          </div>

          <FieldWithAudit fieldName="am_start_time" label="AM Start Time" value={route.am_start_time} formatValue={formatTime} />
          <FieldWithAudit fieldName="pm_start_time" label="PM Start Time" value={route.pm_start_time} formatValue={formatTime} />

          {route.pm_start_time_friday && (
            <FieldWithAudit fieldName="pm_start_time_friday" label="PM Start Time (Friday)" value={route.pm_start_time_friday} formatValue={formatTime} />
          )}

          <FieldWithAudit
            fieldName="days_of_week"
            label="Days of Week"
            value={route.days_of_week}
            formatValue={(val) => {
              if (val && Array.isArray(val) && val.length > 0) {
                return val.join(', ')
              }
              return 'N/A'
            }}
          />

          <div className="flex items-center justify-between py-0.5 gap-2">
            <dt className="text-xs text-slate-500">Created At</dt>
            <dd className="text-xs font-medium text-slate-900">{formatDate(route.created_at)}</dd>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-2.5">
          <div className="flex items-center justify-between mb-1.5 border-b border-slate-100 pb-1">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Crew Assignments
            </h2>
            {showManageSpares && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-slate-300 text-slate-600 px-2"
                onClick={() => setSparesModalOpen(true)}
              >
                <UserCog className="h-3.5 w-3.5 mr-1" />
                Manage Spares
              </Button>
            )}
          </div>

          <dl className="space-y-0">
            <CrewRow
              label="Driver"
              spareBadge={spareDriver ? formatSpareBadgeText(spareDriver) : null}
              spareLink={
                spareDriver && spareDetails.driver
                  ? { href: `/dashboard/drivers/${spareDriver.driver_employee_id}`, label: spareDetails.driver.name }
                  : null
              }
            >
              {route.driver_id ? (
                <Link
                  href={`/dashboard/drivers/${route.driver_id}`}
                  className="text-blue-600 hover:underline"
                >
                  {(() => {
                    const driver = Array.isArray(route.driver) ? route.driver[0] : route.driver
                    const driverEmp = Array.isArray(driver?.employees) ? driver.employees[0] : driver?.employees
                    return driverEmp?.full_name || 'Unknown'
                  })()}
                </Link>
              ) : (
                <span className="text-slate-500">Not assigned</span>
              )}
            </CrewRow>

            <CrewRow
              label="Passenger Assistant(s)"
              spareBadge={sparePa ? formatSpareBadgeText(sparePa) : null}
              spareLink={
                sparePa && spareDetails.pa
                  ? {
                      href: spareDetails.pa.paId ? `/dashboard/assistants/${spareDetails.pa.paId}` : '#',
                      label: spareDetails.pa.name,
                    }
                  : null
              }
            >
              {(() => {
                const pasToShow = routePasList?.length
                  ? routePasList
                  : route.passenger_assistant_id
                    ? [{ employee_id: route.passenger_assistant_id, employees: route.pa, pa_id: null }]
                    : []
                if (pasToShow.length === 0) return <span className="text-slate-500">Not assigned</span>
                return (
                  <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                    {pasToShow.map((r: RoutePasItem, i: number) => {
                      const paEmp = Array.isArray(r.employees) ? r.employees[0] : r.employees
                      const name = paEmp?.full_name || 'Unknown'
                      const paId = r.pa_id ?? null
                      return (
                        <span key={r.employee_id}>
                          {i > 0 && ', '}
                          {paId != null ? (
                            <Link href={`/dashboard/assistants/${paId}`} className="text-blue-600 hover:underline">
                              {name}
                            </Link>
                          ) : (
                            name
                          )}
                        </span>
                      )
                    })}
                  </span>
                )
              })()}
            </CrewRow>

            <CrewRow
              label="Vehicle"
              spareBadge={spareVehicle ? formatSpareBadgeText(spareVehicle) : null}
              spareLink={
                spareVehicle && spareDetails.vehicle
                  ? { href: `/dashboard/vehicles/${spareVehicle.vehicle_id}`, label: spareDetails.vehicle.name }
                  : null
              }
            >
              {route.vehicle_id ? (
                <Link
                  href={`/dashboard/vehicles/${route.vehicle_id}`}
                  className="text-blue-600 hover:underline"
                >
                  {(() => {
                    const vehicle = route.vehicles
                      ? (Array.isArray(route.vehicles) ? route.vehicles[0] : route.vehicles)
                      : null
                    if (!vehicle) return `Vehicle ${route.vehicle_id}`
                    return vehicle.vehicle_identifier || vehicle.registration || `Vehicle ${route.vehicle_id}`
                  })()}
                </Link>
              ) : (
                <span className="text-slate-500">Not assigned</span>
              )}
            </CrewRow>
          </dl>
        </CardContent>
      </Card>

      <ManageSparesModal
        isOpen={sparesModalOpen}
        onClose={() => setSparesModalOpen(false)}
        routeId={routeId}
        spares={spares}
        onSuccess={refetchSpares}
        canSet={canSetSpares}
        canClear={canClearSpares}
      />
    </div>
  )
}
