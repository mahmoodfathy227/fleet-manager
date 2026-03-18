'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/Card'
import { formatDate } from '@/lib/utils'
import { CheckCircle, XCircle, Building2, Phone, Mail, MapPin } from 'lucide-react'

interface FieldAuditInfo {
  field_name: string
  change_time: string
  action: string
  changed_by: string
  changed_by_name: string
}

type EmployeeSnapshot = {
  id?: number
  full_name?: string | null
  role?: string | null
  employment_status?: string | null
  can_work?: boolean | null
  phone_number?: string | null
  personal_email?: string | null
  address?: string | null
  next_of_kin?: string | null
  date_of_birth?: string | null
  start_date?: string | null
  end_date?: string | null
  created_at?: string | null
  updated_at?: string | null
}

interface EmployeeDetailClientProps {
  employeeJson: string
  employeeId: string
}

export default function EmployeeDetailClient({ employeeJson, employeeId }: EmployeeDetailClientProps) {
  let employee: EmployeeSnapshot
  try {
    employee = JSON.parse(employeeJson) as EmployeeSnapshot
  } catch {
    return <p className="text-sm text-rose-600">Invalid employee data.</p>
  }
  if (!employee) return null

  const [fieldAudit, setFieldAudit] = useState<Record<string, FieldAuditInfo>>({})
  const [assignedSchools, setAssignedSchools] = useState<{ id: number; name: string }[]>([])

  useEffect(() => {
    async function fetchFieldAudit() {
      try {
        const response = await fetch(`/api/employees/${employeeId}/field-audit`)
        if (response.ok) {
          const data = await response.json()
          setFieldAudit(data.fieldHistory || {})
        }
      } catch (error) {
        console.error('Error fetching employee field audit:', error)
      }
    }

    fetchFieldAudit()
  }, [employeeId])

  useEffect(() => {
    if (employee?.role !== 'Coordinator' || !employeeId) return
    async function fetchAssignedSchools() {
      try {
        const res = await fetch(`/api/employees/${employeeId}/coordinator-schools`)
        if (res.ok) {
          const data = await res.json()
          setAssignedSchools(data.schools || [])
        }
      } catch (e) {
        console.error('Error fetching coordinator schools:', e)
      }
    }
    fetchAssignedSchools()
  }, [employee?.role, employeeId])

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

  const FieldWithAudit = ({ fieldName, label, value, formatValue }: {
    fieldName: string
    label: string
    value: any
    formatValue?: (val: any) => string
  }) => {
    const auditInfo = getFieldAuditInfo(fieldName)
    const displayValue = formatValue ? formatValue(value) : (value || 'N/A')

    return (
      <div>
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium text-slate-900">{displayValue}</dd>
        {auditInfo && (
          <dd className="mt-0.5 text-xs text-slate-500">
            {auditInfo.action === 'CREATE' ? 'Created' : 'Updated'} by {auditInfo.changed_by_name} on {formatDateTime(auditInfo.change_time)}
          </dd>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column - 4 cols: Contact, Assigned Schools, Basic/Status */}
      <div className="lg:col-span-4 space-y-4">
        {/* Contact Card - driver style */}
        <Card>
          <CardContent className="p-0">
            <div className="p-3 border-b bg-slate-50/50">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact Details</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                  <Phone className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Phone</p>
                  <p className="text-sm font-medium text-slate-900">{employee.phone_number || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-sm font-medium text-slate-900 truncate">{employee.personal_email || 'N/A'}</p>
                </div>
              </div>
              {employee.address && (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Address</p>
                    <p className="text-sm font-medium text-slate-900">{employee.address}</p>
                  </div>
                </div>
              )}
              {(employee.next_of_kin || employee.date_of_birth) && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  {employee.next_of_kin && (
                    <div>
                      <dt className="text-xs text-slate-500">Next of Kin</dt>
                      <dd className="text-sm font-medium text-slate-900">{employee.next_of_kin}</dd>
                    </div>
                  )}
                  {employee.date_of_birth && (
                    <div>
                      <dt className="text-xs text-slate-500">Date of Birth</dt>
                      <dd className="text-sm font-medium text-slate-900">{formatDate(employee.date_of_birth)}</dd>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {employee.role === 'Coordinator' && (
          <Card>
            <CardContent className="p-0">
              <div className="p-3 border-b bg-slate-50/50 flex justify-between items-center">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Schools</h3>
                <Building2 className="h-4 w-4 text-slate-400" />
              </div>
              <div className="p-4">
                {assignedSchools.length === 0 ? (
                  <p className="text-sm text-slate-500">No schools assigned.</p>
                ) : (
                  <ul className="space-y-2">
                    {assignedSchools.map((school) => (
                      <li key={school.id}>
                        <Link
                          href={`/dashboard/schools/${school.id}`}
                          className="text-sm font-medium text-slate-900 hover:text-primary hover:underline"
                        >
                          {school.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Basic Info / Status Card */}
        <Card>
          <CardContent className="p-0">
            <div className="p-3 border-b bg-slate-50/50">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status & Role</h3>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <dt className="text-xs text-slate-500">Employee ID</dt>
                <dd className="text-sm font-medium text-slate-900">{employee.id}</dd>
              </div>
              <FieldWithAudit fieldName="full_name" label="Full Name" value={employee.full_name} />
              <FieldWithAudit fieldName="role" label="Role" value={employee.role} />
              <div>
                <dt className="text-xs text-slate-500">Employment Status</dt>
                <dd className="mt-0.5">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${employee.employment_status === 'Active'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                  >
                    {employee.employment_status || 'N/A'}
                  </span>
                  {getFieldAuditInfo('employment_status') && (
                    <dd className="mt-0.5 text-xs text-slate-500">
                      {getFieldAuditInfo('employment_status')!.action === 'CREATE' ? 'Created' : 'Updated'} by {getFieldAuditInfo('employment_status')!.changed_by_name} on {formatDateTime(getFieldAuditInfo('employment_status')!.change_time)}
                    </dd>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Work Authorization</dt>
                <dd className="mt-0.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${employee.can_work === false
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-green-50 text-green-700 border-green-200'
                      }`}
                  >
                    {employee.can_work === false ? <XCircle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                    {employee.can_work === false ? 'Cannot Work' : 'Authorized to Work'}
                  </span>
                  {getFieldAuditInfo('can_work') && (
                    <dd className="mt-0.5 text-xs text-slate-500">
                      {getFieldAuditInfo('can_work')!.action === 'CREATE' ? 'Created' : 'Updated'} by {getFieldAuditInfo('can_work')!.changed_by_name} on {formatDateTime(getFieldAuditInfo('can_work')!.change_time)}
                    </dd>
                  )}
                </dd>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column - 8 cols: Employment Dates, System Info */}
      <div className="lg:col-span-8 space-y-4">
        <Card>
          <CardContent className="p-0">
            <div className="p-3 border-b bg-slate-50/50">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Employment Dates</h3>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldWithAudit fieldName="start_date" label="Start Date" value={employee.start_date} formatValue={(v) => v ? formatDate(v) : 'N/A'} />
              <FieldWithAudit fieldName="end_date" label="End Date" value={employee.end_date} formatValue={(v) => v ? formatDate(v) : 'N/A'} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="p-3 border-b bg-slate-50/50">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">System Information</h3>
            </div>
            <div className="p-4 flex gap-8">
              <div>
                <dt className="text-xs text-slate-500">Created</dt>
                <dd className="text-sm font-medium text-slate-900">{formatDate(employee.created_at ?? null)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Last Updated</dt>
                <dd className="text-sm font-medium text-slate-900">{formatDate(employee.updated_at ?? null)}</dd>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
