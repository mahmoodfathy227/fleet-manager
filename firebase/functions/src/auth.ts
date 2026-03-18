/**
 * Supabase JWT verification using JWKS (RS256)
 */

import * as jose from 'jose';

let jwksCache: { keys: jose.JSONWebKeySet; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getJwksUrl(): string {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const url = process.env.SUPABASE_URL;
  if (ref) {
    return `https://${ref}.supabase.co/auth/v1/certs`;
  }
  if (url) {
    return `${url.replace(/\/$/, '')}/auth/v1/certs`;
  }
  throw new Error('SUPABASE_PROJECT_REF or SUPABASE_URL must be set');
}

async function fetchJwks(): Promise<jose.JSONWebKeySet> {
  const cached = jwksCache;
  if (cached && Date.now() < cached.expiresAt) {
    return cached.keys;
  }
  const jwksUrl = getJwksUrl();
  const res = await fetch(jwksUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch JWKS: ${res.status}`);
  }
  const keys = (await res.json()) as jose.JSONWebKeySet;
  jwksCache = { keys, expiresAt: Date.now() + CACHE_TTL_MS };
  return keys;
}

export async function verifySupabaseJwt(token: string): Promise<{ uid: string }> {
  if (!token || !token.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }
  const jwt = token.slice(7).trim();
  const jwks = await fetchJwks();
  const JWKS = jose.createLocalJWKSet(jwks);
  const { payload } = await jose.jwtVerify(jwt, JWKS, {
    algorithms: ['RS256'],
    issuer: process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL.replace(/\/$/, '')}/auth/v1` : undefined,
  });
  const sub = payload.sub;
  if (!sub || typeof sub !== 'string') {
    throw new Error('Invalid JWT: missing sub');
  }
  return { uid: sub };
}

export function getAuthHeader(req: { headers?: { authorization?: string } }): string | null {
  const auth = req.headers?.authorization;
  return auth || null;
}
