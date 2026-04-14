import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PaginationBarProps = {
  currentPage: number
  totalRows: number
  pageSize: number
  /** Full path + query for previous page, or null if disabled */
  prevHref: string | null
  /** Full path + query for next page, or null if disabled */
  nextHref: string | null
}

export function PaginationBar({
  currentPage,
  totalRows,
  pageSize,
  prevHref,
  nextHref,
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const showingFrom = totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const showingTo = Math.min(currentPage * pageSize, totalRows)

  if (process.env.NODE_ENV === 'development') {
    console.debug('[PaginationBar]', { currentPage, totalRows, pageSize, totalPages })
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
      <p className="tabular-nums">
        Showing <span className="font-medium text-slate-900">{showingFrom}</span>
        {'–'}
        <span className="font-medium text-slate-900">{showingTo}</span>
        {' of '}
        <span className="font-medium text-slate-900">{totalRows}</span>
        {totalPages > 1 && (
          <span className="text-slate-500">
            {' '}
            (page {currentPage} of {totalPages})
          </span>
        )}
      </p>
      <div className="flex items-center gap-2">
        {prevHref ? (
          <Link
            href={prevHref}
            className={cn(
              'inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-input bg-background px-3 text-xs font-medium shadow-sm',
              'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Link>
        ) : (
          <span
            className={cn(
              'inline-flex h-8 cursor-not-allowed items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-400'
            )}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </span>
        )}
        {nextHref ? (
          <Link
            href={nextHref}
            className={cn(
              'inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-input bg-background px-3 text-xs font-medium shadow-sm',
              'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
            )}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span
            className={cn(
              'inline-flex h-8 cursor-not-allowed items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-400'
            )}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  )
}
