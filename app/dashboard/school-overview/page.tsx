import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Eye, AlertTriangle, CheckCircle, GraduationCap, Building } from 'lucide-react'
import { formatDate } from '@/lib/utils'

async function getSchools() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .order('name')

  if (error) {
    console.error('Error fetching schools:', error)
    return []
  }

  return data || []
}

async function getSchoolOverview(schoolId: number) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('school_route_overview')
    .select('*')
    .eq('school_id', schoolId)

  if (error) {
    console.error('Error fetching school overview:', error)
    return []
  }

  return data || []
}

export default async function SchoolOverviewPage() {
  const schools = await getSchools()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">School Route Overview</h1>
        <p className="text-sm text-slate-500">Comprehensive view of schools with routes, crew, vehicles, and passengers</p>
      </div>

      {schools.map((school) => (
        <SchoolOverviewCard key={school.id} school={school} />
      ))}

      {schools.length === 0 && (
        <Card className="border-slate-200">
          <CardContent className="py-12">
            <Building className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-center text-slate-500 font-medium">No schools found</p>
            <p className="text-center text-sm text-slate-400">Add your first school to get started</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

async function SchoolOverviewCard({ school }: { school: any }) {
  const routes = await getSchoolOverview(school.id)

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="bg-white border-b border-slate-100 py-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl text-slate-800">{school.name}</CardTitle>
            <div className="text-sm text-slate-500 mt-1">
              {school.ref_number && <span className="font-medium">Ref: {school.ref_number} • </span>}
              {school.address || 'No address'}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-slate-600">
              {school.phone_number && (
                <span>Phone: {school.phone_number}</span>
              )}
              {school.contact_email && (
                <span>Email: <a href={`mailto:${school.contact_email}`} className="text-primary hover:text-primary/80 hover:underline">{school.contact_email}</a></span>
              )}
              {school.contact_name && (
                <span>Contact: {school.contact_name}</span>
              )}
              {!school.phone_number && !school.contact_email && !school.contact_name && (
                <span className="text-slate-400">No contact details</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{routes.length}</p>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">Routes</p>
            </div>
            <Link href={`/dashboard/schools/${school.id}`} prefetch={true}>
              <Button size="sm" variant="outline" className="text-primary border-primary/20 hover:bg-primary/10">
                View Details
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {routes.length === 0 ? (
          <div className="py-12 text-center">
            <AlertTriangle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No routes assigned to this school yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>PA</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Passengers</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {routes.map((route: any) => {
                  const totalPassengers = route.total_passengers || 0
                  const wheelchairPassengers = route.wheelchair_passengers || 0
                  const seatsTotal = route.seats_total || 0
                  const wheelchairCapacity = route.wheelchair_capacity || 0

                  const isOvercapacity = seatsTotal > 0 && totalPassengers > seatsTotal
                  const isWheelchairOvercapacity = wheelchairCapacity > 0 && wheelchairPassengers > wheelchairCapacity
                  const hasIssues = isOvercapacity || isWheelchairOvercapacity || (!route.driver_id && !route.pa_id) || !route.vehicle_id

                  return (
                    <TableRow key={route.route_id} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="font-semibold text-slate-800">{route.route_number || `Route ${route.route_id}`}</div>
                      </TableCell>
                      <TableCell>
                        {route.driver_name ? (
                          <div>
                            <div className="font-semibold text-sm text-slate-800">{route.driver_name}</div>
                            <div className="text-xs text-slate-500">
                              {route.driver_phone || 'No phone'}
                            </div>
                            {route.driver_dbs_expiry && (
                              <div className="text-xs text-slate-400">
                                DBS: {formatDate(route.driver_dbs_expiry)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-rose-600 text-sm font-medium">Not Assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {route.pa_name ? (
                          <div>
                            <div className="font-semibold text-sm text-slate-800">{route.pa_name}</div>
                            <div className="text-xs text-slate-500">
                              {route.pa_phone || 'No phone'}
                            </div>
                            {route.pa_dbs_expiry && (
                              <div className="text-xs text-slate-400">
                                DBS: {formatDate(route.pa_dbs_expiry)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-rose-600 text-sm font-medium">Not Assigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {route.vehicle_identifier ? (
                          <div>
                            <div className="font-semibold text-sm text-slate-800">{route.vehicle_identifier}</div>
                            <div className="text-xs text-slate-500">
                              {route.vehicle_registration || 'No reg'}
                            </div>
                            <div className="text-xs text-slate-400">
                              {route.vehicle_make} {route.vehicle_model}
                            </div>
                            {route.vehicle_off_road && (
                              <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                                VOR
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-amber-600 text-sm font-medium">No Vehicle</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {seatsTotal > 0 ? (
                          <div>
                            <div className="text-sm">
                              <span className={totalPassengers > seatsTotal ? 'text-rose-600 font-bold' : 'text-slate-800'}>
                                {totalPassengers}
                              </span>
                              <span className="text-slate-500"> / {seatsTotal} seats</span>
                            </div>
                            {wheelchairCapacity > 0 && (
                              <div className="text-xs text-slate-500">
                                <span className={wheelchairPassengers > wheelchairCapacity ? 'text-rose-600 font-bold' : ''}>
                                  {wheelchairPassengers}
                                </span>
                                <span className="text-slate-400"> / {wheelchairCapacity} ♿</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 text-sm">No config</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">{totalPassengers}</span>
                          {wheelchairPassengers > 0 && (
                            <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">
                              {wheelchairPassengers} ♿
                            </span>
                          )}
                          {route.sen_passengers > 0 && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              {route.sen_passengers} SEN
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {hasIssues ? (
                          <div className="flex items-center gap-1 text-rose-600">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-xs font-medium">
                              {[
                                (!route.driver_id && !route.pa_id) && 'No Crew',
                                !route.vehicle_id && 'No Vehicle',
                                isOvercapacity && 'Overcapacity',
                                isWheelchairOvercapacity && '♿ Overcapacity'
                              ].filter(Boolean).join(' ')}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-xs font-medium">OK</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/dashboard/routes/${route.route_id}?from=school-overview`} prefetch={true}>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-primary hover:bg-primary/10">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}




