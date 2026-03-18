'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import AddIncidentForm from './AddIncidentForm'
import { Modal } from '@/components/ui/Modal'

interface AddIncidentSectionProps {
  passengerId: number
  passengerRouteId: number | null
}

export default function AddIncidentSection({
  passengerId,
  passengerRouteId,
}: AddIncidentSectionProps) {
  const [showForm, setShowForm] = useState(false)

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs hover:bg-red-100 text-red-600 font-medium"
        onClick={() => setShowForm(true)}
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        Add Incident
      </Button>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Report New Incident"
        className="max-w-3xl"
      >
        <AddIncidentForm
          passengerId={passengerId}
          passengerRouteId={passengerRouteId}
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      </Modal>
    </>
  )
}


