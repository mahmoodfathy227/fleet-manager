'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

type ExpiryPeriod = '30-days' | '14-days' | 'expired'

interface FilterTab {
  label: string
  value: ExpiryPeriod
  icon: string
  description: string
}

const filterTabs: FilterTab[] = [
  {
    label: '30 Days',
    value: '30-days',
    icon: '📅',
    description: 'Expiring within 30 days',
  },
  {
    label: '14 Days',
    value: '14-days',
    icon: '⚠️',
    description: 'Critical - 14 days or less',
  },
  {
    label: 'Expired',
    value: 'expired',
    icon: '🔴',
    description: 'Already expired',
  },
]

interface CertificateExpiryFilterProps {
  currentPeriod: ExpiryPeriod
  counts: Record<ExpiryPeriod, number>
}

export function CertificateExpiryFilter({ currentPeriod, counts }: CertificateExpiryFilterProps) {
  const pathname = usePathname() ?? ''

  return (
    <div className="border-b border-gray-200 bg-white">
      <nav className="-mb-px flex space-x-8 px-6" aria-label="Certificate expiry filter">
        {filterTabs.map((tab) => {
          const isActive = currentPeriod === tab.value
          const href = tab.value === '30-days' 
            ? pathname 
            : `${pathname}?period=${tab.value}`
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
              <span className="mr-2 text-lg">{tab.icon}</span>
              <div className="flex flex-col">
                <span>{tab.label}</span>
                <span className="text-xs text-gray-500">{tab.description}</span>
              </div>
              <span
                className={cn(
                  'ml-3 rounded-full px-2.5 py-0.5 text-xs font-medium',
                  isActive
                    ? 'bg-navy text-white'
                    : count > 0
                    ? tab.value === 'expired'
                      ? 'bg-red-100 text-red-700'
                      : tab.value === '14-days'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-600'
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

