'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { AlertTriangle } from 'lucide-react'

export default function EmployeeDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Employee detail error:', error)
  }, [error])

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-900">Something went wrong</h2>
              <p className="mt-1 text-sm text-slate-600">
                We couldn’t load this employee. This can happen after a deployment or if the page is outdated.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={reset}>Try again</Button>
                <Link href="/dashboard/employees">
                  <Button variant="outline">Back to employees</Button>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
