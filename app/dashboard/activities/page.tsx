import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Upload, Calendar, ExternalLink, CheckCircle2, Clock } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'

async function getSystemActivities() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('system_activities')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching system activities:', error)
    return []
  }

  return data || []
}

function getEntityLink(entityType: string, entityId: number): string {
  if (entityType === 'vehicle') {
    return `/dashboard/vehicles/${entityId}`
  } else if (entityType === 'driver' || entityType === 'assistant') {
    return `/dashboard/employees/${entityId}`
  }
  return '#'
}

function getActivityIcon(activityType: string) {
  switch (activityType) {
    case 'document_upload':
      return <Upload className="h-5 w-5 text-blue-600" />
    case 'appointment_booking':
      return <Calendar className="h-5 w-5 text-green-600" />
    default:
      return <Clock className="h-5 w-5 text-gray-600" />
  }
}

function getActivityBadge(activityType: string) {
  switch (activityType) {
    case 'document_upload':
      return (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
          Document Upload
        </span>
      )
    case 'appointment_booking':
      return (
        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
          Appointment Booked
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
          {activityType}
        </span>
      )
  }
}

async function SystemActivitiesTable() {
  const activities = await getSystemActivities()

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Activities</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Certificate</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                  No system activities found.
                </TableCell>
              </TableRow>
            ) : (
              activities.map((activity: any) => (
                <TableRow key={activity.id}>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {getActivityIcon(activity.activity_type)}
                      {getActivityBadge(activity.activity_type)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{activity.certificate_name}</div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{activity.entity_name || `#${activity.entity_id}`}</div>
                      <div className="text-sm text-gray-500 capitalize">{activity.entity_type}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="text-sm">{activity.recipient_name || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{activity.recipient_email || ''}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm space-y-1">
                      {activity.activity_type === 'document_upload' && activity.details && (
                        <>
                          <div><strong>Files:</strong> {activity.details.filesUploaded || 0}</div>
                          {activity.details.fileNames && activity.details.fileNames.length > 0 && (
                            <div className="text-xs text-gray-600">
                              {activity.details.fileNames.slice(0, 2).join(', ')}
                              {activity.details.fileNames.length > 2 && ` +${activity.details.fileNames.length - 2} more`}
                            </div>
                          )}
                          {activity.details.uploadedFileUrls && activity.details.uploadedFileUrls.length > 0 && (
                            <div className="mt-1 space-y-1">
                              {activity.details.uploadedFileUrls.slice(0, 3).map((url: string, idx: number) => (
                                <a
                                  key={idx}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-blue-600 hover:underline block"
                                >
                                  View File {idx + 1}
                                </a>
                              ))}
                              {activity.details.uploadedFileUrls.length > 3 && (
                                <span className="text-xs text-gray-500">
                                  +{activity.details.uploadedFileUrls.length - 3} more files
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      )}
                      {activity.activity_type === 'appointment_booking' && activity.details && (
                        <>
                          <div><strong>Date:</strong> {activity.details.appointmentDate || 'N/A'}</div>
                          <div><strong>Time:</strong> {activity.details.appointmentTime || 'N/A'}</div>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-gray-600">
                      {formatDateTime(activity.created_at)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={getEntityLink(activity.entity_type, activity.entity_id)}
                      className="text-blue-600 hover:underline flex items-center space-x-1"
                    >
                      <span>View</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export default async function SystemActivitiesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">System Activities</h1>
        <p className="mt-2 text-sm text-gray-600">
          View document uploads and appointment bookings
        </p>
      </div>

      <Suspense fallback={<TableSkeleton />}>
        <SystemActivitiesTable />
      </Suspense>
    </div>
  )
}

