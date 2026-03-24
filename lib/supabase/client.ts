import { createBrowserClient } from '@supabase/ssr'

/** Placeholder only for SSR / `next build` prerender when env is unset; browser always requires real keys. */
const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const PLACEHOLDER_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.build-placeholder-not-for-auth'

function getBrowserSupabaseConfig(): { url: string; key: string } {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  ).trim()
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim()
  if (!url || !key) {
    console.debug('[fleet supabase] createClient: missing env', { hasUrl: Boolean(url), hasKey: Boolean(key) })
    if (typeof window !== 'undefined') {
      throw new Error(
        'Supabase env missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart the dev server. If you use npm start, run npm run build again after adding them (public env is embedded at build time).'
      )
    }
    console.debug('[fleet supabase] createClient: using placeholder for SSR/build prerender only')
    return { url: url || PLACEHOLDER_URL, key: key || PLACEHOLDER_ANON_KEY }
  }
  return { url, key }
}

export function createClient() {
  const { url, key } = getBrowserSupabaseConfig()
  return createBrowserClient(url, key)
}

