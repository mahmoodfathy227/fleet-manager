import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Suspense } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Plus, Eye, Pencil, Users } from 'lucide-react'
import { formatDate } from '@/lib/utils'

async function getParentContacts() {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('parent_contacts')
    .select(`
      *,
      passenger_parent_contacts (
        passenger_id
      )
    `)
    .order('full_name')

  if (error) {
    console.error('Error fetching parent contacts:', error)
    return []
  }

  return data || []
}

async function ParentContactsTable() {
  const contacts = await getParentContacts()

  return (
    <div className="rounded-md border bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Full Name</TableHead>
            <TableHead>Relationship</TableHead>
            <TableHead>Phone Number</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Passengers</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-gray-500">
                No parent contacts found. Add your first parent contact to get started.
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
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                      <Users className="mr-1 h-3 w-3" />
                      {passengerCount} {passengerCount === 1 ? 'Passenger' : 'Passengers'}
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
  )
}

export default function ParentContactsPage() {
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

      <Card>
        <CardHeader className="bg-navy text-white">
          <CardTitle>All Parent Contacts</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <Suspense fallback={<TableSkeleton rows={5} columns={7} />}>
            <ParentContactsTable />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}

