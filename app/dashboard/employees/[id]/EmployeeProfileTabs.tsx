'use client'

import { useState } from 'react'

interface EmployeeProfileTabsProps {
  overview: React.ReactNode
  documents: React.ReactNode
}

export default function EmployeeProfileTabs({ overview, documents }: EmployeeProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'documents'>('overview')

  return (
    <>
      <div className="border-b border-slate-200">
        <div className="flex items-center gap-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`pb-3 ${activeTab === 'overview' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`pb-3 ${activeTab === 'documents' ? 'text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Documents & Certificates
          </button>
        </div>
      </div>
      {activeTab === 'overview' && overview}
      {activeTab === 'documents' && documents}
    </>
  )
}
