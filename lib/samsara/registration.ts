export function normalizeRegistration(registration: string | null | undefined): string {
  if (!registration) return ''
  return registration.toUpperCase().replace(/[^A-Z0-9]/g, '')
}
