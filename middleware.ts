import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = await updateSession(request)

  // Check if user is authenticated for protected routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            // Not used in middleware
          },
          remove(name: string, options: any) {
            // Not used in middleware
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Check user approval status (except for admin routes)
    // Note: This check is also done in login page, but middleware provides additional protection
    if (!request.nextUrl.pathname.startsWith('/dashboard/admin')) {
      const { data: userData } = await supabase
        .from('users')
        .select('approval_status')
        .eq('email', user.email)
        .single()

      if (userData && userData.approval_status !== 'approved') {
        // Redirect to login with error message
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('error', 'not_approved')
        return NextResponse.redirect(loginUrl)
      }
    }
  }

  // Redirect authenticated users away from login/signup
  if (
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/signup'
  ) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            // Not used in middleware
          },
          remove(name: string, options: any) {
            // Not used in middleware
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

