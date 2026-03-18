import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ArrowLeft, Pencil, Users, Mail, Phone, MapPin } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { notFound } from 'next/navigation'

async function getParentContact(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('parent_contacts')
    .select(`
      *,
      passenger_parent_contacts (
        passenger_id,
        passengers (
          id,
          full_name,
          dob,
          school_id,
          schools (
            name
          )
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

export default async function ViewParentContactPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const contact = await getParentContact(id)

  if (!contact) {
    notFound()
  }

  const passengers = contact.passenger_parent_contacts || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard/parent-contacts">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-navy">{contact.full_name}</h1>
            <p className="mt-2 text-sm text-gray-600">
              {contact.relationship || 'Parent/Guardian'} Contact Details
            </p>
          </div>
        </div>
        <Link href={`/dashboard/parent-contacts/${contact.id}/edit`}>
          <Button>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="bg-navy text-white">
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">ID</dt>
              <dd className="mt-1 text-sm text-gray-900">{contact.id}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Full Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{contact.full_name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Relationship</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {contact.relationship || 'N/A'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <Phone className="h-4 w-4 mr-1" />
                Phone Number
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {contact.phone_number ? (
                  <a href={`tel:${contact.phone_number}`} className="text-navy hover:underline">
                    {contact.phone_number}
                  </a>
                ) : (
                  'N/A'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <Mail className="h-4 w-4 mr-1" />
                Email
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="text-navy hover:underline">
                    {contact.email}
                  </a>
                ) : (
                  'N/A'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 flex items-center">
                <MapPin className="h-4 w-4 mr-1" />
                Address
              </dt>
              <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                {contact.address || 'N/A'}
              </dd>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-navy text-white">
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Created At</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {formatDate(contact.created_at)}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Updated At</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {formatDate(contact.updated_at)}
              </dd>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="bg-navy text-white">
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            Associated Passengers ({passengers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {passengers.length === 0 ? (
            <p className="text-sm text-gray-500 italic">
              No passengers linked to this contact
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {passengers.map((link: any) => {
                const passenger = link.passengers
                return (
                  <Link
                    key={passenger.id}
                    href={`/dashboard/passengers/${passenger.id}`}
                    prefetch={true}
                  >
                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-blue-50 hover:border-navy transition-colors cursor-pointer">
                      <div>
                        <p className="text-sm font-medium text-navy">
                          {passenger.full_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {passenger.schools?.name || 'No school assigned'}
                        </p>
                        {passenger.dob && (
                          <p className="text-xs text-gray-500">
                            DOB: {formatDate(passenger.dob)}
                          </p>
                        )}
                      </div>
                      <ArrowLeft className="h-4 w-4 text-gray-400 rotate-180" />
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

