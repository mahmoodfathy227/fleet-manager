import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import Link from 'next/link'
import {
  Users, Car, School, Route, AlertCircle, UserCheck, MapPinned,
  ParkingCircle, Calendar, XCircle, Activity,
  TrendingUp, ArrowRight, Clock, Zap, Target, Sparkles
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

// ============================================================================
// DATA FETCHING (Unchanged - preserving all business logic)
// ============================================================================

async function getDashboardStats() {
  const supabase = await createClient()
  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    { count: employeeCount },
    { count: vehicleCount },
    { count: schoolCount },
    { count: routeCount },
    { count: passengerCount },
    { count: incidentCount },
    { count: incidentsThisMonthCount },
    { count: spareVehicleCount },
    { count: spareWithLocationCount },
    { count: vorCount },
    { count: flaggedEmployeesCount },
  ] = await Promise.all([
    supabase.from('employees').select('*', { count: 'exact', head: true }),
    supabase.from('vehicles').select('*', { count: 'exact', head: true }),
    supabase.from('schools').select('*', { count: 'exact', head: true }),
    supabase.from('routes').select('*', { count: 'exact', head: true }),
    supabase.from('passengers').select('*', { count: 'exact', head: true }),
    supabase.from('incidents').select('*', { count: 'exact', head: true }).eq('resolved', false),
    supabase.from('incidents').select('*', { count: 'exact', head: true }).gte('reported_at', firstDayOfMonth),
    supabase.from('vehicles').select('*', { count: 'exact', head: true })
      .eq('spare_vehicle', true)
      .or('off_the_road.is.null,off_the_road.eq.false'),
    supabase.from('vehicle_locations').select('vehicle_id, vehicles!inner(spare_vehicle)', { count: 'exact', head: true })
      .eq('vehicles.spare_vehicle', true),
    supabase.from('vehicles').select('*', { count: 'exact', head: true })
      .eq('off_the_road', true),
    supabase.from('employees').select('*', { count: 'exact', head: true })
      .eq('can_work', false),
  ])

  const today = new Date()
  const fourteenDaysAhead = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
  const thirtyDaysAhead = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

  const { data: vehicles } = await supabase.from('vehicles').select('*')
  const { data: drivers } = await supabase.from('drivers').select('*')
  const { data: assistants } = await supabase.from('passenger_assistants').select('*')

  let employeeExpired = 0, employeeExpiring14Days = 0, employeeExpiring30Days = 0
  let vehicleExpired = 0, vehicleExpiring14Days = 0, vehicleExpiring30Days = 0

  const checkEmployeeExpiry = (date: string | null) => {
    if (!date) return
    const expiryDate = new Date(date)
    if (expiryDate < today) employeeExpired++
    else if (expiryDate <= fourteenDaysAhead) employeeExpiring14Days++
    if (expiryDate >= today && expiryDate <= thirtyDaysAhead) employeeExpiring30Days++
  }

  const checkVehicleExpiry = (date: string | null) => {
    if (!date) return
    const expiryDate = new Date(date)
    if (expiryDate < today) vehicleExpired++
    else if (expiryDate <= fourteenDaysAhead) vehicleExpiring14Days++
    if (expiryDate >= today && expiryDate <= thirtyDaysAhead) vehicleExpiring30Days++
  }

  drivers?.forEach(d => {
    checkEmployeeExpiry(d.tas_badge_expiry_date)
    checkEmployeeExpiry(d.taxi_badge_expiry_date)
    checkEmployeeExpiry(d.dbs_expiry_date)
    checkEmployeeExpiry(d.first_aid_certificate_expiry_date)
    checkEmployeeExpiry(d.passport_expiry_date)
    checkEmployeeExpiry(d.driving_license_expiry_date)
    checkEmployeeExpiry(d.cpc_expiry_date)
    checkEmployeeExpiry(d.vehicle_insurance_expiry_date)
    checkEmployeeExpiry(d.mot_expiry_date)
  })

  assistants?.forEach(a => {
    checkEmployeeExpiry(a.tas_badge_expiry_date)
    checkEmployeeExpiry(a.dbs_expiry_date)
  })

  vehicles?.forEach(v => {
    checkVehicleExpiry(v.plate_expiry_date)
    checkVehicleExpiry(v.insurance_expiry_date)
    checkVehicleExpiry(v.mot_date)
    checkVehicleExpiry(v.tax_date)
    checkVehicleExpiry(v.loler_expiry_date)
    checkVehicleExpiry(v.first_aid_expiry)
    checkVehicleExpiry(v.fire_extinguisher_expiry)
  })

  return {
    employees: employeeCount || 0,
    vehicles: vehicleCount || 0,
    schools: schoolCount || 0,
    routes: routeCount || 0,
    passengers: passengerCount || 0,
    incidents: incidentCount || 0,
    incidentsThisMonth: incidentsThisMonthCount || 0,
    spareVehicles: spareVehicleCount || 0,
    spareWithLocation: spareWithLocationCount || 0,
    vor: vorCount || 0,
    flaggedEmployees: flaggedEmployeesCount || 0,
    employeeExpired,
    employeeExpiring14Days,
    employeeExpiring30Days,
    vehicleExpired,
    vehicleExpiring14Days,
    vehicleExpiring30Days,
  }
}

async function getRecentActivities() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('system_activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(4)
  return data || []
}

async function getRecentIncidents() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('incidents')
    .select(`id, incident_type, description, reported_at, resolved, reference_number, routes(route_number), vehicles(vehicle_identifier)`)
    .order('reported_at', { ascending: false })
    .limit(4)
  return data || []
}

// ============================================================================
// DASHBOARD UI
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-200" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8 h-64 rounded-2xl bg-slate-200" />
        <div className="lg:col-span-4 h-64 rounded-2xl bg-slate-200" />
      </div>
    </div>
  )
}

async function DashboardContent() {
  const stats = await getDashboardStats()
  const activities = await getRecentActivities()
  const incidents = await getRecentIncidents()

  const totalAlerts = stats.incidents + stats.employeeExpired + stats.vehicleExpired + stats.vor + stats.flaggedEmployees

  return (
    <div className="flex flex-col gap-4 min-h-[calc(100vh-120px)]">
      {/* Row 1: Stats Grid - 4 cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {/* Employees - deep navy */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 via-blue-700 to-blue-600 p-5 text-white shadow-lg shadow-blue-900/30 hover:shadow-xl transition-all">
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/10 rounded-full" />
          <div className="relative flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Users className="h-7 w-7" />
            </div>
            <div>
              <p className="text-3xl font-bold">{stats.employees}</p>
              <p className="text-blue-200/90 text-sm">Employees</p>
            </div>
          </div>
        </div>

        {/* Vehicles - cyan / teal blue */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-600 via-sky-500 to-blue-400 p-5 text-white shadow-lg shadow-cyan-500/25 hover:shadow-xl transition-all">
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/10 rounded-full" />
          <div className="relative flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Car className="h-7 w-7" />
            </div>
            <div>
              <p className="text-3xl font-bold">{stats.vehicles}</p>
              <p className="text-cyan-100 text-sm">Vehicles</p>
            </div>
          </div>
        </div>

        {/* Routes - indigo / violet blue */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-500 to-blue-500 p-5 text-white shadow-lg shadow-indigo-600/25 hover:shadow-xl transition-all">
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/10 rounded-full" />
          <div className="relative flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <Route className="h-7 w-7" />
            </div>
            <div>
              <p className="text-3xl font-bold">{stats.routes}</p>
              <p className="text-indigo-200/90 text-sm">Routes</p>
            </div>
          </div>
        </div>

        {/* Passengers - light sky blue */}
        <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 via-blue-400 to-cyan-300 p-5 text-white shadow-lg shadow-sky-500/25 hover:shadow-xl transition-all">
          <div className="absolute -top-6 -right-6 w-20 h-20 bg-white/10 rounded-full" />
          <div className="relative flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <UserCheck className="h-7 w-7" />
            </div>
            <div>
              <p className="text-3xl font-bold">{stats.passengers}</p>
              <p className="text-sky-100 text-sm">Passengers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Main Grid - grows to fill space */}
      <div className="grid gap-4 lg:grid-cols-12 flex-1">
        {/* Left: Recent Incidents (8 cols) */}
        <div className="lg:col-span-8 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-slate-800">Recent Incidents</h3>
            </div>
            <Link href="/dashboard/incidents" className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
            {incidents.length === 0 ? (
              <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
                <Zap className="h-8 w-8 text-emerald-500 mb-2" />
                <p className="text-slate-600 font-medium">All clear!</p>
                <p className="text-sm text-slate-400">No recent incidents</p>
              </div>
            ) : (
              incidents.slice(0, 4).map((incident: any) => (
                <Link key={incident.id} href={`/dashboard/incidents/${incident.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                  <div className={`h-3 w-3 rounded-full flex-shrink-0 ${incident.resolved ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{incident.incident_type}</p>
                    <p className="text-sm text-slate-400 truncate">{incident.description || 'No description'}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${incident.resolved ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {incident.resolved ? 'Resolved' : 'Open'}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Right: Action Required + Compliance Stack (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Action Required */}
          {totalAlerts > 0 && (
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Action Required</h3>
                  <p className="text-sm text-slate-400">{totalAlerts} items need attention</p>
                </div>
              </div>
              <div className="space-y-2">
                {stats.incidents > 0 && (
                  <Link href="/dashboard/incidents" className="flex items-center justify-between p-3 rounded-xl bg-rose-50 hover:bg-rose-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-rose-600" />
                      <span className="text-sm text-slate-700">Open Incidents</span>
                    </div>
                    <span className="text-lg font-bold text-rose-600">{stats.incidents}</span>
                  </Link>
                )}
                {stats.employeeExpired > 0 && (
                  <Link href="/dashboard/certificates-expiry/employees?period=expired" className="flex items-center justify-between p-3 rounded-xl bg-orange-50 hover:bg-orange-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-orange-600" />
                      <span className="text-sm text-slate-700">Expired Certs</span>
                    </div>
                    <span className="text-lg font-bold text-orange-600">{stats.employeeExpired}</span>
                  </Link>
                )}
                {stats.vor > 0 && (
                  <Link href="/dashboard/vehicles?status=off-road" className="flex items-center justify-between p-3 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <XCircle className="h-5 w-5 text-amber-600" />
                      <span className="text-sm text-slate-700">Off Road</span>
                    </div>
                    <span className="text-lg font-bold text-amber-600">{stats.vor}</span>
                  </Link>
                )}
                {stats.flaggedEmployees > 0 && (
                  <Link href="/dashboard/employees" className="flex items-center justify-between p-3 rounded-xl bg-yellow-50 hover:bg-yellow-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-yellow-600" />
                      <span className="text-sm text-slate-700">Flagged Staff</span>
                    </div>
                    <span className="text-lg font-bold text-yellow-600">{stats.flaggedEmployees}</span>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Compliance Status */}
          <div className="rounded-2xl bg-gradient-to-br from-primary via-blue-600 to-blue-500 p-5 text-white shadow-lg flex-1">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Compliance Status
            </h3>
            <div className="space-y-4">
              <Link href="/dashboard/certificates-expiry/employees" className="block">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-blue-100">Employee Certs</span>
                  <span className="text-amber-300 font-medium">{stats.employeeExpiring30Days} expiring</span>
                </div>
                <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 rounded-full" style={{ width: `${Math.min((stats.employeeExpiring30Days / Math.max(stats.employees, 1)) * 100 + 10, 100)}%` }} />
                </div>
              </Link>
              <Link href="/dashboard/certificates-expiry/vehicles" className="block">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-blue-100">Vehicle Certs</span>
                  <span className="text-rose-300 font-medium">{stats.vehicleExpiring30Days} expiring</span>
                </div>
                <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-rose-400 to-pink-300 rounded-full" style={{ width: `${Math.min((stats.vehicleExpiring30Days / Math.max(stats.vehicles, 1)) * 100 + 10, 100)}%` }} />
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Bottom row - Activity + Quick Stats */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Activity */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-sky-500" />
            Recent Activity
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {activities.length === 0 ? (
              <p className="text-sm text-slate-400 col-span-2 text-center py-4">No recent activity</p>
            ) : (
              activities.slice(0, 4).map((activity: any) => (
                <div key={activity.id} className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-sm text-slate-700 capitalize truncate font-medium">{activity.activity_type?.replace('_', ' ')}</p>
                  <p className="text-xs text-slate-400">{formatDateTime(activity.created_at)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Quick Stats
          </h3>
          <div className="grid grid-cols-4 gap-3">
            <Link href="/dashboard/schools" className="text-center p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
              <School className="h-6 w-6 mx-auto text-emerald-500 mb-2" />
              <p className="text-2xl font-bold text-slate-800">{stats.schools}</p>
              <p className="text-xs text-slate-500">Schools</p>
            </Link>
            <Link href="/dashboard/spares" className="text-center p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
              <ParkingCircle className="h-6 w-6 mx-auto text-amber-500 mb-2" />
              <p className="text-2xl font-bold text-slate-800">{stats.spareVehicles}</p>
              <p className="text-xs text-slate-500">Spare</p>
            </Link>
            <Link href="/dashboard/vehicle-locations" className="text-center p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
              <MapPinned className="h-6 w-6 mx-auto text-sky-500 mb-2" />
              <p className="text-2xl font-bold text-slate-800">{stats.spareWithLocation}</p>
              <p className="text-xs text-slate-500">Tracked</p>
            </Link>
            <Link href="/dashboard/incidents" className="text-center p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
              <Calendar className="h-6 w-6 mx-auto text-blue-500 mb-2" />
              <p className="text-2xl font-bold text-slate-800">{stats.incidentsThisMonth}</p>
              <p className="text-xs text-slate-500">Month</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{greeting} 👋</h1>
          <p className="text-slate-500 text-sm">Here's what's happening with your fleet</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Clock className="h-3.5 w-3.5" />
          <span>{now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}
