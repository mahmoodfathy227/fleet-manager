import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import './globals.css'

const montserrat = Montserrat({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Fleet Admin Dashboard',
  description: 'Comprehensive fleet management system',
  icons: {
    icon: '/assets/countylogofin.png',
    apple: '/assets/countylogofin.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={montserrat.className} suppressHydrationWarning>{children}</body>
    </html>
  )
}

