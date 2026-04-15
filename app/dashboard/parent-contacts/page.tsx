import { ParentContactsListPageContent } from './parent-contacts-listing'

export default function ParentContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; relationship?: string }>
}) {
  return (
    <ParentContactsListPageContent
      searchParams={searchParams}
      listBasePath="/dashboard/parent-contacts"
      headingTitle="Parent contacts"
      cardTitle="All parent contacts"
    />
  )
}
