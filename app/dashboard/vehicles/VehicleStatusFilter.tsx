'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type VehicleStatus = 'all' | 'active' | 'spare' | 'off-road'

interface FilterTab {
  label: string
  value: VehicleStatus
  icon: string
}

const filterTabs: FilterTab[] = [
  { label: 'All Vehicles', value: 'all', icon: '🚗' },
  { label: 'Active', value: 'active', icon: '✅' },
  { label: 'Spare', value: 'spare', icon: '🅿️' },
  { label: 'VOR', value: 'off-road', icon: '🔴' },
]

interface VehicleStatusFilterProps {
  currentStatus: VehicleStatus
  counts: Record<VehicleStatus, number>
}

export function VehicleStatusFilter({ currentStatus, counts }: VehicleStatusFilterProps) {
  const pathname = usePathname() ?? ''

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8" aria-label="Vehicle status filter">
        {filterTabs.map((tab) => {
          const isActive = currentStatus === tab.value
          const href = tab.value === 'all' ? pathname : `${pathname}?status=${tab.value}`
          const count = counts[tab.value] || 0

          return (
            <Link
              key={tab.value}
              href={href}
              prefetch={true}
              className={cn(
                'group inline-flex items-center border-b-2 px-1 py-4 text-sm font-medium transition-colors',
                isActive
                  ? 'border-navy text-navy'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              )}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
              <span
                className={cn(
                  'ml-2 rounded-full px-2.5 py-0.5 text-xs font-medium',
                  isActive
                    ? 'bg-navy text-white'
                    : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200'
                )}
              >
                {count}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

