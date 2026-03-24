/**
 * Edge Middleware only gets env vars that were available at `next build` time (inlined).
 * NEXT_PUBLIC_* must be set in .env.local before building; then run `npm start`.
 */
export function getSupabaseEdgeConfig(): { url: string; anonKey: string } | null {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  ).trim()
  const anonKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim()
  if (!url || !anonKey) {
    console.debug('[fleet supabase] getSupabaseEdgeConfig: missing', {
      hasUrl: Boolean(url),
      hasAnonKey: Boolean(anonKey),
    })
    return null
  }
  return { url, anonKey }
}
