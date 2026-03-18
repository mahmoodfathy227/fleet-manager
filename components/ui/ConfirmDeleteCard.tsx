'use client'

import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { AlertTriangle } from 'lucide-react'

export interface ConfirmDeleteCardProps {
  /** Entity name to show in the message (e.g. "Safia Ali", "Springfield School") */
  entityName: string
  /** List of items that will be permanently deleted */
  items: string[]
  /** Label for the confirm button (e.g. "Yes, Delete PA") */
  confirmLabel: string
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  loading?: boolean
  error?: string | null
}

/**
 * Standard confirmation card shown before deleting any entity.
 * Displays: "Confirm Deletion", entity name, "This will permanently delete: [list]", "This action cannot be undone!"
 */
export function ConfirmDeleteCard({
  entityName,
  items,
  confirmLabel,
  onConfirm,
  onCancel,
  loading = false,
  error = null,
}: ConfirmDeleteCardProps) {
  return (
    <Card className="border-l-4 border-red-500 bg-red-50">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 mb-2">
                Confirm Deletion
              </h3>
              <p className="text-sm text-red-700 mb-3">
                Are you sure you want to delete <strong>{entityName}</strong>?
              </p>
              <div className="bg-red-100 border border-red-200 rounded p-3 mb-3">
                <p className="text-xs font-semibold text-red-900 mb-1">
                  This will permanently delete:
                </p>
                <ul className="text-xs text-red-800 list-disc list-inside space-y-1">
                  {items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
                <p className="text-xs font-bold text-red-900 mt-2">
                  This action cannot be undone!
                </p>
              </div>
              {error && (
                <div className="mb-3 p-2 bg-red-200 border border-red-300 rounded text-xs text-red-900">
                  {error}
                </div>
              )}
              <div className="flex space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onCancel}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={onConfirm}
                  disabled={loading}
                >
                  {loading ? 'Deleting...' : confirmLabel}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
