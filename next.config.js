/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/assets/countylogofin.png' }]
  },
}

module.exports = nextConfig

