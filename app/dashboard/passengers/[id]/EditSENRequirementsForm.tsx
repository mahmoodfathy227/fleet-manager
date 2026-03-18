'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Label } from '@/components/ui/Label'
import { Card, CardContent } from '@/components/ui/Card'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface EditSENRequirementsFormProps {
  passengerId: number
  currentValue: string | null
  onSuccess: () => void
  onCancel: () => void
}

export default function EditSENRequirementsForm({
  passengerId,
  currentValue,
  onSuccess,
  onCancel,
}: EditSENRequirementsFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [senRequirements, setSenRequirements] = useState(currentValue || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: updateError } = await supabase
        .from('passengers')
        .update({ sen_requirements: senRequirements || null })
        .eq('id', passengerId)

      if (updateError) throw updateError

      // Audit log
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_name: 'passengers',
          record_id: passengerId,
          action: 'UPDATE',
        }),
      }).catch(err => console.error('Audit log error:', err))

      router.refresh()
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to update SEN requirements')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-2 border-blue-200 bg-blue-50">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="sen_requirements">SEN Requirements</Label>
            <textarea
              id="sen_requirements"
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={senRequirements}
              onChange={(e) => setSenRequirements(e.target.value)}
              placeholder="Enter SEN requirements..."
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

