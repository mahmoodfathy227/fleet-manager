'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Pencil, X } from 'lucide-react'
import EditSENRequirementsForm from './EditSENRequirementsForm'

interface EditSENRequirementsSectionProps {
  passengerId: number
  currentValue: string | null
}

export default function EditSENRequirementsSection({
  passengerId,
  currentValue,
}: EditSENRequirementsSectionProps) {
  const [showForm, setShowForm] = useState(false)

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          variant={showForm ? 'secondary' : 'primary'}
        >
          {showForm ? (
            <>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </>
          ) : (
            <>
              <Pencil className="mr-2 h-4 w-4" />
              Edit SEN Requirements
            </>
          )}
        </Button>
      </div>

      {showForm && (
        <EditSENRequirementsForm
          passengerId={passengerId}
          currentValue={currentValue}
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}
    </>
  )
}

