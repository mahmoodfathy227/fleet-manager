import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { PaginationBar } from '@/components/ui/PaginationBar'
import { Plus, Eye, Pencil, Users } from 'lucide-react'
import { ParentContactsSearchFilters } from './ParentContactsSearchFilters'

const PAGE_SIZE = 25

/** Escape `%`, `_`, and `\` so user input cannot broaden a LIKE / ILIKE pattern. */
function escapeIlikePattern(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export type ParentContactsListFilters = {
  search?: string
  relationship?: string
}

function parseRelationshipFilter(raw?: string): 'Mother' | 'Father' | 'Guardian' | 'other' | undefined {
  if (!raw || raw === 'all') return undefined
  const r = raw.trim()
  const lower = r.toLowerCase()
  if (lower === 'other') return 'other'
  if (lower === 'mother') return 'Mother'
  if (lower === 'father') return 'Father'
  if (lower === 'guardian') return 'Guardian'
  if (r === 'Mother' || r === 'Father' || r === 'Guardian') return r
  return undefined
}

function buildParentContactsQueryString(args: {
  page?: number
  search?: string
  relationship?: string
}) {
  const p = new URLSearchParams()
  if (args.search?.trim()) p.set('search', args.search.trim())
  if (args.relationship && args.relationship !== 'all') p.set('relationship', args.relationship)
  if (args.page && args.page > 1) p.set('page', String(args.page))
  const q = p.toString()
  return q ? `?${q}` : ''
}

async function getParentContacts(requestedPage: number, filters: ParentContactsListFilters) {
  const supabase = await createClient()

  const from = (requestedPage - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('parent_contacts')
    .select(
      `
      *,
      passenger_parent_contacts (
        passenger_id
      )
    `,
      { count: 'exact' }
    )

  const searchTrimmed = filters.search?.trim()
  if (searchTrimmed) {
    const term = escapeIlikePattern(searchTrimmed)
    query = query.or(
      `full_name.ilike.%${term}%,phone_number.ilike.%${term}%,email.ilike.%${term}%`
    )
  }

  const rel = parseRelationshipFilter(filters.relationship)
  if (rel === 'Mother' || rel === 'Father' || rel === 'Guardian') {
    query = query.ilike('relationship', rel)
  } else if (rel === 'other') {
    query = query.or('relationship.is.null,relationship.not.in.(Mother,Father,Guardian)')
  }

  query = query.order('full_name').range(from, to)

  const { data, error, count } = await query

  if (error) {
    console.error('[parent-contacts-list] Error fetching parent contacts:', error)
    return { contacts: [] as any[], totalCount: 0, page: 1, pageSize: PAGE_SIZE }
  }

  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  if (requestedPage > totalPages) {
    const qs = buildParentContactsQueryString({
      page: totalPages,
      search: filters.search,
      relationship: filters.relationship,
    })
    redirect(`/dashboard/parent-contacts${qs}`)
  }

  if (process.env.NODE_ENV === 'development') {
    console.debug('[parent-contacts-list]', {
      page: requestedPage,
      totalCount,
      returned: (data || []).length,
      hasSearch: Boolean(searchTrimmed),
      relationship: rel ?? filters.relationship ?? 'all',
    })
  }

  return {
    contacts: data || [],
    totalCount,
    page: requestedPage,
    pageSize: PAGE_SIZE,
  }
}

async function ParentContactsTable({
  requestedPage,
  filters,
}: {
  requestedPage: number
  filters: ParentContactsListFilters
}) {
  const { contacts, totalCount, page, pageSize } = await getParentContacts(requestedPage, filters)

  const base = {
    search: filters.search,
    relationship: filters.relationship,
  }

  const prevHref =
    page > 1
      ? `/dashboard/parent-contacts${buildParentContactsQueryString({ ...base, page: page - 1 })}`
      : null
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const nextHref =
    page < totalPages
      ? `/dashboard/parent-contacts${buildParentContactsQueryString({ ...base, page: page + 1 })}`
      : null

  const hasActiveFilters =
    Boolean(filters.search?.trim()) || Boolean(filters.relationship && filters.relationship !== 'all')

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Relationship</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="whitespace-nowrap min-w-[9.5rem]">Passengers</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-10">
                  {hasActiveFilters ? (
                    <>
                      <p className="font-medium text-gray-700">No contacts match your filters</p>
                      <p className="mt-1 text-sm text-gray-500">Try adjusting search or relationship</p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-gray-700">No parent contacts found</p>
                      <p className="mt-1 text-sm text-gray-500">Add your first parent contact to get started</p>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact: any) => {
                const passengerCount = contact.passenger_parent_contacts?.length || 0

                return (
                  <TableRow key={contact.id}>
                    <TableCell>{contact.id}</TableCell>
                    <TableCell className="font-medium">{contact.full_name}</TableCell>
                    <TableCell>{contact.relationship || 'N/A'}</TableCell>
                    <TableCell>{contact.phone_number || 'N/A'}</TableCell>
                    <TableCell>{contact.email || 'N/A'}</TableCell>
                    <TableCell className="whitespace-nowrap align-middle">
                      <span
                        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium leading-none text-blue-900"
                        title={`${passengerCount} linked ${passengerCount === 1 ? 'passenger' : 'passengers'}`}
                      >
                        <Users className="h-3.5 w-3.5 shrink-0 text-[#023E8A]" aria-hidden />
                        <span className="whitespace-nowrap text-[#023E8A]">
                          {passengerCount} {passengerCount === 1 ? 'Passenger' : 'Passengers'}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Link href={`/dashboard/parent-contacts/${contact.id}`} prefetch={true}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/dashboard/parent-contacts/${contact.id}/edit`} prefetch={true}>
                          <Button variant="ghost" size="sm">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalCount > 0 && (
        <PaginationBar
          currentPage={page}
          totalRows={totalCount}
          pageSize={pageSize}
          prevHref={prevHref}
          nextHref={nextHref}
        />
      )}
    </div>
  )
}

export default async function ParentContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; relationship?: string }>
}) {
  const params = await searchParams
  const rawPage = parseInt(params?.page ?? '1', 10)
  const requestedPage = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1

  const filters: ParentContactsListFilters = {
    search: params?.search,
    relationship: params?.relationship,
  }

  const suspenseKey = JSON.stringify({ ...filters, page: requestedPage })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy">Parent Contacts</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage emergency contacts and guardians for passengers
          </p>
        </div>
        <Link href="/dashboard/parent-contacts/create" prefetch={true}>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Parent Contact
          </Button>
        </Link>
      </div>

      <Suspense fallback={<div className="h-24 w-full max-w-3xl rounded-lg bg-gray-100 animate-pulse" />}>
        <ParentContactsSearchFilters />
      </Suspense>

      <Card>
        <CardHeader className="rounded-t-xl bg-navy text-white">
          <CardTitle className="text-white">All Parent Contacts</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <Suspense key={suspenseKey} fallback={<TableSkeleton rows={5} columns={7} />}>
            <ParentContactsTable requestedPage={requestedPage} filters={filters} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
