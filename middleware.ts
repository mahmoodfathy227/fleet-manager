import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { getSupabaseEdgeConfig } from '@/lib/supabase/edge-env'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const edgeCfg = getSupabaseEdgeConfig()
  if (!edgeCfg) {
    console.debug(
      '[fleet middleware] blocked: add NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then npm run build, then npm start'
    )
    return new NextResponse(
      'Configuration error: missing Supabase anon key. In .env.local set NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY to the anon (public) key from Supabase → Settings → API (not the service_role key). Set URL via NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL. Then run npm run build before npm start.',
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } }
    )
  }

  const { url: supabaseUrl, anonKey: supabaseAnonKey } = edgeCfg
  const response = await updateSession(request, edgeCfg)

  // Check if user is authenticated for protected routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
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
    const supabaseLogin = createServerClient(supabaseUrl, supabaseAnonKey, {
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
    })

    const { data: { user } } = await supabaseLogin.auth.getUser()

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

