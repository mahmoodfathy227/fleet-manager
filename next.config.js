/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  // Edge + client: empty NEXT_PUBLIC_* still reads as ""; fall back to SUPABASE_* aliases from .env.local
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  },
  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/assets/countylogofin.png' }]
  },
}

module.exports = nextConfig

