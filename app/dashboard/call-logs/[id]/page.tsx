import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ArrowLeft } from 'lucide-react'
import { CallLogViewActions } from './CallLogViewActions'
import { formatDateTime } from '@/lib/utils'
import { notFound } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'

export const dynamic = 'force-dynamic'

/** Shaped for this page’s JSX; row comes from Supabase then normalized. */
type CallLogDetail = {
  id: number
  call_date?: string | null
  caller_name?: string | null
  caller_phone?: string | null
  call_to_type?: string | null
  call_type?: string | null
  priority?: string | null
  status?: string | null
  subject?: string | null
  notes?: string | null
  action_taken?: string | null
  action_required?: boolean | null
  follow_up_required?: boolean | null
  follow_up_date?: string | null
  passengers?: { id: number; full_name: string | null } | null
  employees?: { id: number; full_name: string | null } | null
  routes?: { id: number; route_number: string | null } | null
  driver: {
    employee_id: number
    employees: { full_name?: string | null } | null
  } | null
  assistant: {
    employee_id: number
    employees: { full_name?: string | null } | null
  } | null
  outgoingReceiverParent: { id: number; full_name: string | null } | null
  outgoingReceiverEmployee: { id: number; full_name: string | null } | null
}

function normalizeEmployeeEmbed<T extends { employees?: { full_name?: string } | { full_name?: string }[] | null }>(
  row: T | null
): T | null {
  if (!row?.employees) return row
  const e = row.employees
  if (Array.isArray(e) && e[0]) return { ...row, employees: e[0] }
  return row
}

async function getCallLog(idParam: string): Promise<CallLogDetail | null> {
  noStore()
  const numericId = parseInt(idParam, 10)
  if (Number.isNaN(numericId) || numericId < 1) {
    console.debug('[ViewCallLogPage] getCallLog invalid id', idParam)
    return null
  }

  const supabase = await createClient()

  const joined = await supabase
    .from('call_logs')
    .select(`
      *,
      passengers(full_name, id),
      employees(full_name, id),
      routes(route_number, id)
    `)
    .eq('id', numericId)
    .maybeSingle()

  if (joined.error) {
    console.error('[ViewCallLogPage] joined select error', joined.error.message)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase row + embeds; narrowed at return
  let data: any = joined.data

  if (!data) {
    const plain = await supabase.from('call_logs').select('*').eq('id', numericId).maybeSingle()
    if (plain.error) {
      console.error('[ViewCallLogPage] fallback select error', plain.error.message)
      return null
    }
    if (!plain.data) {
      console.debug('[ViewCallLogPage] no row for id', numericId)
      return null
    }
    data = plain.data
    console.debug('[ViewCallLogPage] loaded via fallback select', numericId)

    if (data.related_passenger_id && !data.passengers) {
      const { data: p } = await supabase.from('passengers').select('id, full_name').eq('id', data.related_passenger_id).maybeSingle()
      if (p) data.passengers = p
    }
    if (data.related_employee_id && !data.employees) {
      const { data: e } = await supabase.from('employees').select('id, full_name').eq('id', data.related_employee_id).maybeSingle()
      if (e) data.employees = e
    }
    if (data.related_route_id && !data.routes) {
      const { data: r } = await supabase.from('routes').select('id, route_number').eq('id', data.related_route_id).maybeSingle()
      if (r) data.routes = r
    }
  } else {
    console.debug('[ViewCallLogPage] loaded via joined select', numericId)
  }

  // Fetch driver and assistant separately if they exist
  let driver = null
  let assistant = null

  if (data.related_driver_id) {
    const { data: driverData } = await supabase
      .from('drivers')
      .select('employee_id, employees(full_name)')
      .eq('employee_id', data.related_driver_id)
      .maybeSingle()
    driver = normalizeEmployeeEmbed(driverData)
  }

  if (data.related_assistant_id) {
    const { data: assistantData } = await supabase
      .from('passenger_assistants')
      .select('employee_id, employees(full_name)')
      .eq('employee_id', data.related_assistant_id)
      .maybeSingle()
    assistant = normalizeEmployeeEmbed(assistantData)
  }

  let outgoingReceiverParent = null
  let outgoingReceiverEmployee = null
  if (data.outgoing_receiver_parent_contact_id) {
    const { data: parentData } = await supabase
      .from('parent_contacts')
      .select('id, full_name')
      .eq('id', data.outgoing_receiver_parent_contact_id)
      .maybeSingle()
    outgoingReceiverParent = parentData
  }
  if (data.outgoing_receiver_employee_id) {
    const { data: empData } = await supabase
      .from('employees')
      .select('id, full_name')
      .eq('id', data.outgoing_receiver_employee_id)
      .maybeSingle()
    outgoingReceiverEmployee = empData
  }

  return {
    ...data,
    driver,
    assistant,
    outgoingReceiverParent,
    outgoingReceiverEmployee,
  } as CallLogDetail
}

type PageProps = { params: Promise<{ id: string }> | { id: string } }

export default async function ViewCallLogPage({ params }: PageProps) {
  const { id } = await Promise.resolve(params)
  console.debug('[ViewCallLogPage] route id param', id)
  const callLog = await getCallLog(id)
  if (!callLog) notFound()

  return (
    <div className="space-y-4">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/call-logs">
            <Button variant="outline" size="sm" className="h-9 px-3 gap-2 text-slate-600 border-slate-300 hover:bg-slate-50">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Call Log #{callLog.id}</h1>
            <p className="text-sm text-slate-500">{formatDateTime(callLog.call_date ?? null)}</p>
          </div>
        </div>
        <CallLogViewActions id={callLog.id} subject={callLog.subject} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-2.5 px-4"><CardTitle className="text-sm font-semibold text-slate-700">Caller Information</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Caller Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{callLog.caller_name || 'N/A'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Phone Number</dt>
              <dd className="mt-1 text-sm text-gray-900">{callLog.caller_phone || 'N/A'}</dd>
            </div>
            {callLog.call_to_type && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Call To/From</dt>
                <dd className="mt-1 text-sm text-gray-900">{callLog.call_to_type}</dd>
              </div>
            )}
            {(callLog.outgoingReceiverParent || callLog.outgoingReceiverEmployee) && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Outgoing call receiver</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {callLog.outgoingReceiverParent
                    ? `Parent: ${callLog.outgoingReceiverParent.full_name || 'Unknown'}`
                    : callLog.outgoingReceiverEmployee
                      ? `Employee: ${callLog.outgoingReceiverEmployee.full_name || 'Unknown'}`
                      : 'N/A'}
                </dd>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-2.5 px-4"><CardTitle className="text-sm font-semibold text-slate-700">Call Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Call Type</dt>
              <dd className="mt-1"><span className="inline-flex rounded-full px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800">{callLog.call_type || 'N/A'}</span></dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Priority</dt>
              <dd className="mt-1">
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${callLog.priority === 'Urgent' ? 'bg-red-100 text-red-800' :
                  callLog.priority === 'High' ? 'bg-orange-100 text-orange-800' :
                    callLog.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                  }`}>{callLog.priority || 'Low'}</span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1">
                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${callLog.status === 'Resolved' || callLog.status === 'Closed' ? 'bg-green-100 text-green-800' :
                  callLog.status === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>{callLog.status || 'Open'}</span>
              </dd>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-2.5 px-4"><CardTitle className="text-sm font-semibold text-slate-700">Subject & Notes</CardTitle></CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Subject</dt>
            <dd className="mt-1 text-sm text-gray-900">{callLog.subject}</dd>
          </div>
          {callLog.notes && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Call Notes</dt>
              <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{callLog.notes}</dd>
            </div>
          )}
          {callLog.action_taken && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Action Taken</dt>
              <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{callLog.action_taken}</dd>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-2.5 px-4"><CardTitle className="text-sm font-semibold text-slate-700">Related Information</CardTitle></CardHeader>
        <CardContent className="space-y-3 pt-4">
          {callLog.passengers && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Related Passenger</dt>
              <dd className="mt-1">
                <Link href={`/dashboard/passengers/${callLog.passengers.id}`} className="text-blue-600 hover:underline">
                  {callLog.passengers.full_name}
                </Link>
              </dd>
            </div>
          )}
          {callLog.driver && callLog.driver.employees && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Related Driver</dt>
              <dd className="mt-1">
                <Link href={`/dashboard/employees/${callLog.driver.employee_id}`} className="text-blue-600 hover:underline">
                  {callLog.driver.employees.full_name}
                </Link>
              </dd>
            </div>
          )}
          {callLog.assistant && callLog.assistant.employees && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Related Assistant (PA)</dt>
              <dd className="mt-1">
                <Link href={`/dashboard/employees/${callLog.assistant.employee_id}`} className="text-blue-600 hover:underline">
                  {callLog.assistant.employees.full_name}
                </Link>
              </dd>
            </div>
          )}
          {callLog.employees && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Related Employee (Other)</dt>
              <dd className="mt-1">
                <Link href={`/dashboard/employees/${callLog.employees.id}`} className="text-blue-600 hover:underline">
                  {callLog.employees.full_name}
                </Link>
              </dd>
            </div>
          )}
          {callLog.routes && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Related Route</dt>
              <dd className="mt-1">
                <Link href={`/dashboard/routes/${callLog.routes.id}`} className="text-blue-600 hover:underline">
                  {callLog.routes.route_number}
                </Link>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-sm font-medium text-gray-500">Action Required</dt>
            <dd className="mt-1 text-sm text-gray-900">{callLog.action_required ? 'Yes' : 'No'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Follow-up Required</dt>
            <dd className="mt-1 text-sm text-gray-900">{callLog.follow_up_required ? `Yes - ${callLog.follow_up_date ? formatDateTime(callLog.follow_up_date) : 'No date set'}` : 'No'}</dd>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}









