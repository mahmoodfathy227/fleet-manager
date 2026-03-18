/**
 * Firebase Cloud Functions base URL for push notifications
 */

const base = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL;
if (!base && typeof window !== 'undefined') {
  console.warn('NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL is not set');
}

export function getFunctionsUrl(path: string): string {
  const url = base || '';
  return `${url.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}
