import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ArrowLeft, Pencil } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { notFound } from 'next/navigation'

async function getCallLog(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('call_logs')
    .select(`
      *,
      passengers(full_name, id),
      employees(full_name, id),
      routes(route_number, id)
    `)
    .eq('id', id)
    .single()

  if (error || !data) return null

  // Fetch driver and assistant separately if they exist
  let driver = null
  let assistant = null

  if (data.related_driver_id) {
    const { data: driverData } = await supabase
      .from('drivers')
      .select('employee_id, employees(full_name)')
      .eq('employee_id', data.related_driver_id)
      .single()
    driver = driverData
  }

  if (data.related_assistant_id) {
    const { data: assistantData } = await supabase
      .from('passenger_assistants')
      .select('employee_id, employees(full_name)')
      .eq('employee_id', data.related_assistant_id)
      .single()
    assistant = assistantData
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

  return { ...data, driver, assistant, outgoingReceiverParent, outgoingReceiverEmployee }
}

export default async function ViewCallLogPage({ params }: { params: { id: string } }) {
  const callLog = await getCallLog(params.id)
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
            <p className="text-sm text-slate-500">{formatDateTime(callLog.call_date)}</p>
          </div>
        </div>
        <Link href={`/dashboard/call-logs/${callLog.id}/edit`}>
          <Button variant="outline" className="border-slate-300 text-slate-600 hover:bg-slate-50">
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </Link>
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









