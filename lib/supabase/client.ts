import { createBrowserClient } from '@supabase/ssr'

function getBrowserSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !key) {
    console.debug('[fleet supabase] createClient: missing env', { hasUrl: Boolean(url), hasKey: Boolean(key) })
    throw new Error(
      'Supabase env missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart the dev server. If you use npm start, run npm run build again after adding them (public env is embedded at build time).'
    )
  }
  return { url, key }
}

export function createClient() {
  const { url, key } = getBrowserSupabaseConfig()
  return createBrowserClient(url, key)
}

