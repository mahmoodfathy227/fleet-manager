import { ComplianceTabs } from './ComplianceTabs'

export default function ComplianceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="space-y-6">
      <ComplianceTabs />
      {children}
    </div>
  )
}
