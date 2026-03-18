import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatDateTime } from '@/lib/utils'

async function getDocuments() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documents')
    .select('*, employees(full_name), users(email)')
    .order('uploaded_at', { ascending: false })

  if (error) {
    console.error('Error fetching documents:', error)
    return []
  }

  return data || []
}

async function DocumentsTable() {
  const documents = await getDocuments()

  return (
    <div className="rounded-md border bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>File Name</TableHead>
            <TableHead>File Type</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead>Uploaded By</TableHead>
            <TableHead>Uploaded At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-gray-500">
                No documents found.
              </TableCell>
            </TableRow>
          ) : (
            documents.map((doc: any) => (
              <TableRow key={doc.id}>
                <TableCell>{doc.id}</TableCell>
                <TableCell className="font-medium">{doc.file_name || 'N/A'}</TableCell>
                <TableCell>{doc.file_type || 'N/A'}</TableCell>
                <TableCell>{doc.employees?.full_name || 'N/A'}</TableCell>
                <TableCell>{doc.users?.email || 'N/A'}</TableCell>
                <TableCell>{formatDateTime(doc.uploaded_at)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy">Documents</h1>
          <p className="mt-2 text-sm text-gray-600">View all uploaded documents</p>
        </div>
      </div>

      <Suspense fallback={<TableSkeleton rows={5} columns={6} />}>
        <DocumentsTable />
      </Suspense>
    </div>
  )
}
