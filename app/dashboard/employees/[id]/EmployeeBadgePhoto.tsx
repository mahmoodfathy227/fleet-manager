'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface EmployeeBadgePhotoProps {
  employeeId: number
  employeeName: string
  badgeNumber?: string | null
  size?: 'default' | 'sm'
}

export default function EmployeeBadgePhoto({ employeeId, employeeName, badgeNumber, size = 'default' }: EmployeeBadgePhotoProps) {
  const [badgePhotoUrl, setBadgePhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const isSm = size === 'sm'
  const sizeClass = isSm ? 'h-12 w-12' : 'h-24 w-24'
  const textSizeClass = isSm ? 'text-sm' : 'text-2xl'
  const borderClass = isSm ? 'border-2 border-white shadow-sm' : 'border-4 border-primary shadow-lg shadow-primary/25'

  useEffect(() => {
    async function fetchBadgePhoto() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('documents')
        .select('file_url, file_path')
        .eq('employee_id', employeeId)
        .eq('doc_type', 'ID Badge Photo')
        .order('uploaded_at', { ascending: false })
        .limit(1)

      if (!error && data && data.length > 0) {
        const badgePhotoDoc = data[0]
        // Use file_url if available, otherwise get public URL from file_path
        if (badgePhotoDoc.file_url) {
          setBadgePhotoUrl(badgePhotoDoc.file_url)
        } else if (badgePhotoDoc.file_path) {
          const { data: { publicUrl } } = supabase.storage
            .from('EMPLOYEE_DOCUMENTS')
            .getPublicUrl(badgePhotoDoc.file_path)
          setBadgePhotoUrl(publicUrl)
        }
      }
      setLoading(false)
    }

    fetchBadgePhoto()
  }, [employeeId])

  const initials = employeeName
    ? employeeName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'EM'

  if (loading) {
    return (
      <div className="relative">
        <div className={`${sizeClass} rounded-full bg-slate-200 flex items-center justify-center border-slate-300 animate-pulse ${isSm ? 'border-2' : 'border-4'}`}>
          <span className="text-slate-400 font-bold">...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {badgePhotoUrl ? (
        <img
          src={badgePhotoUrl}
          alt={`${employeeName} - ID Badge`}
          className={`${sizeClass} rounded-full object-cover bg-slate-100 ${borderClass}`}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      ) : (
        <div className={`${sizeClass} rounded-full flex items-center justify-center ${borderClass} ${isSm ? 'bg-slate-200' : 'bg-gradient-to-br from-primary to-blue-600'}`}>
          <span className={`font-bold ${isSm ? 'text-slate-500' : 'text-white'} ${textSizeClass}`}>
            {initials}
          </span>
        </div>
      )}
      {badgeNumber && !isSm && (
        <div className="absolute -bottom-1 -right-1 bg-primary text-white text-xs font-semibold px-2 py-1 rounded-full border-2 border-white shadow-md shadow-primary/25">
          {badgeNumber}
        </div>
      )}
    </div>
  )
}
