'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

interface AssistantDetailClientProps {
  assistant: {
    id: number
    employee_id: number
    tas_badge_number: string | null
    tas_badge_expiry_date: string | null
    dbs_number: string | null
    employees: {
      id: number
      full_name: string
      role: string | null
      employment_status: string | null
      phone_number: string | null
      personal_email: string | null
      start_date: string | null
      end_date: string | null
      can_work: boolean | null
    } | null
  }
}

export default function AssistantDetailClient({ assistant }: AssistantDetailClientProps) {
  const [idBadgePhotoUrl, setIdBadgePhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchIdBadgePhoto() {
      if (!assistant.employee_id) {
        setLoading(false)
        return
      }

      const supabase = createClient()
      const { data, error } = await supabase
        .from('documents')
        .select('id, file_name, file_url, file_type, doc_type, uploaded_at, file_path')
        .eq('employee_id', assistant.employee_id)
        .order('uploaded_at', { ascending: false })

      if (error) {
        console.error('Error fetching documents:', error)
        setLoading(false)
        return
      }

      // Find ID Badge photo
      const idBadgeDoc = data?.find(doc => {
        if (!doc.doc_type) return false
        const docTypeLower = doc.doc_type.toLowerCase()
        return docTypeLower === 'id badge' ||
          (docTypeLower.includes('id') && docTypeLower.includes('badge'))
      })

      if (idBadgeDoc) {
        const parseFileUrls = (fileUrl: string | null): string[] => {
          if (!fileUrl) return []
          try {
            const parsed = JSON.parse(fileUrl)
            return Array.isArray(parsed) ? parsed : [fileUrl]
          } catch {
            return [fileUrl]
          }
        }

        const urls = parseFileUrls(idBadgeDoc.file_url || idBadgeDoc.file_path)
        // Find first image URL
        let imageUrl = urls.find(url =>
          url && (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.gif'))
        ) || urls[0]

        // If we have a file_path but no public URL, try to get it from storage
        if (!imageUrl && idBadgeDoc.file_path) {
          const { data: { publicUrl } } = supabase.storage
            .from('ROUTE_DOCUMENTS')
            .getPublicUrl(idBadgeDoc.file_path)
          imageUrl = publicUrl
        }

        if (imageUrl) {
          setIdBadgePhotoUrl(imageUrl)
        }
      }

      setLoading(false)
    }

    fetchIdBadgePhoto()
  }, [assistant.employee_id])

  const employee = assistant.employees
  const initials = employee?.full_name
    ? employee.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'PA'

  return (
    <div className="relative">
      {idBadgePhotoUrl ? (
        <img
          src={idBadgePhotoUrl}
          alt={`${employee?.full_name || 'Assistant'} - ID Badge`}
          className="h-24 w-24 rounded-full object-cover border-4 border-primary shadow-lg shadow-primary/25"
          onError={(e) => {
            // Fallback if image fails to load
            e.currentTarget.style.display = 'none'
          }}
        />
      ) : (
        <div className="h-24 w-24 rounded-full bg-primary flex items-center justify-center border-4 border-primary shadow-lg shadow-primary/25">
          <span className="text-white text-2xl font-bold">{initials}</span>
        </div>
      )}
      {assistant.tas_badge_number && (
        <div className="absolute -bottom-1 -right-1 bg-primary text-white text-xs font-semibold px-2 py-1 rounded-full border-2 border-white shadow-md shadow-primary/25">
          {assistant.tas_badge_number}
        </div>
      )}
    </div>
  )
}

