'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import AddParentContactForm from './AddParentContactForm'
import { Modal } from '@/components/ui/Modal'

interface AddParentContactSectionProps {
  passengerId: number
}

export default function AddParentContactSection({ passengerId }: AddParentContactSectionProps) {
  const [showForm, setShowForm] = useState(false)

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs text-slate-500 hover:text-slate-900 font-medium"
        onClick={() => setShowForm(true)}
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        Add Parent Contact
      </Button>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Add Parent Contact"
        className="max-w-2xl"
      >
        <AddParentContactForm
          passengerId={passengerId}
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      </Modal>
    </>
  )
}

