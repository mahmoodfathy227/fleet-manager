'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ConfirmDeleteCard } from '@/components/ui/ConfirmDeleteCard'
import { ArrowLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function DeleteIncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [checkingPermissions, setCheckingPermissions] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unauthorized, setUnauthorized] = useState(false)
  const [incident, setIncident] = useState<any>(null)

  useEffect(() => {
    async function loadData() {
      const { id } = await params

      // Check permissions first - only super admin can delete
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        setUnauthorized(true)
        setCheckingPermissions(false)
        return
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id, role')
        .eq('email', authUser.email)
        .maybeSingle()

      if (!userData || userData.role !== 'super_admin') {
        setUnauthorized(true)
        setCheckingPermissions(false)
        return
      }

      // Load incident
      const { data: incidentData, error: incidentError } = await supabase
        .from('incidents')
        .select('*')
        .eq('id', id)
        .single()

      if (incidentError || !incidentData) {
        setError('Incident not found')
        setCheckingPermissions(false)
        return
      }

      setIncident(incidentData)
      setCheckingPermissions(false)
    }

    loadData()
  }, [params, supabase])

  const handleDelete = async () => {
    setLoading(true)
    setError(null)
    const { id } = await params

    try {
      // Delete related records first
      await supabase.from('incident_employees').delete().eq('incident_id', id)
      await supabase.from('incident_passengers').delete().eq('incident_id', id)

      // Delete the incident
      const { error: deleteError } = await supabase
        .from('incidents')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      // Audit log
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'incidents',
          record_id: parseInt(id),
          action: 'DELETE',
        }),
      }).catch(err => console.error('Audit log error:', err))

      router.push('/dashboard/incidents')
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'An error occurred while deleting the incident')
    } finally {
      setLoading(false)
    }
  }

  if (checkingPermissions) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    )
  }

  if (unauthorized) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard/incidents">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
              <p className="text-gray-600">Only super administrators can delete incidents.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!incident) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Incident not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link href={`/dashboard/incidents/${incident.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-red-600">Delete Incident #{incident.id}</h1>
          <p className="mt-2 text-sm text-gray-600">This action cannot be undone</p>
        </div>
      </div>

      <ConfirmDeleteCard
        entityName={`Incident #${incident.id}`}
        items={[
          'The incident record',
          'All linked employees and passengers',
          'All incident notes and attachments',
          'Any TR5/TR7 form data linked to this incident',
        ]}
        confirmLabel="Yes, Delete Incident"
        onConfirm={handleDelete}
        onCancel={() => {
          router.push(`/dashboard/incidents/${incident.id}`)
        }}
        loading={loading}
        error={error}
      />
    </div>
  )
}

