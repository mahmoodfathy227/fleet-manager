"use strict";
/**
 * Supabase JWT verification using JWKS (RS256)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifySupabaseJwt = verifySupabaseJwt;
exports.getAuthHeader = getAuthHeader;
const jose = __importStar(require("jose"));
let jwksCache = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
function getJwksUrl() {
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
async function fetchJwks() {
    const cached = jwksCache;
    if (cached && Date.now() < cached.expiresAt) {
        return cached.keys;
    }
    const jwksUrl = getJwksUrl();
    const res = await fetch(jwksUrl);
    if (!res.ok) {
        throw new Error(`Failed to fetch JWKS: ${res.status}`);
    }
    const keys = (await res.json());
    jwksCache = { keys, expiresAt: Date.now() + CACHE_TTL_MS };
    return keys;
}
async function verifySupabaseJwt(token) {
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
function getAuthHeader(req) {
    var _a;
    const auth = (_a = req.headers) === null || _a === void 0 ? void 0 : _a.authorization;
    return auth || null;
}
//# sourceMappingURL=auth.js.map