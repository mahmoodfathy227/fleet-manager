'use client'

import Link from 'next/link'
import Image from 'next/image'
import { CheckCircle, Clock } from 'lucide-react'

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg text-center">
        <div className="flex justify-center mb-6">
          <div className="relative w-24 h-24">
            <Image
              src="/assets/countylogofin.png"
              alt="CountyCars Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>
        <div className="flex justify-center">
          <div className="rounded-full bg-yellow-100 p-4">
            <Clock className="h-12 w-12 text-yellow-600" />
          </div>
        </div>
        <div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Account Pending Approval
          </h2>
          <p className="mt-4 text-sm text-gray-600">
            Your account has been created successfully, but it requires admin approval before you can access the system.
          </p>
          <p className="mt-2 text-sm text-gray-600">
            You will be notified via email once your account has been reviewed and approved.
          </p>
        </div>
        <div className="mt-8">
          <Link
            href="/login"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Return to Login
          </Link>
        </div>
      </div>
    </div>
  )
}

