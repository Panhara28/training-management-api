import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { MOCOAuthClient } from 'moc-oauth-client';

// AAS (MOC OAuth) login for staff. Server-side only — MOC_OAUTH_CLIENT_SECRET
// must never reach the browser.

export const MOC_EMAIL_DOMAIN = '@moc.gov.kh';
export const PKCE_COOKIE = 'moc_oauth_pkce';
export const PKCE_COOKIE_PATH = '/api/auth/moc-oauth';
export const PKCE_TTL_SECONDS = 5 * 60;

// Lazily constructed: the constructor throws if any MOC_OAUTH_* var is
// missing, and building it at import time would crash the whole API on boot
// in environments where AAS isn't configured yet.
let client: MOCOAuthClient | null = null;

export function getMocOAuthClient(): MOCOAuthClient {
  if (!client) {
    client = new MOCOAuthClient({
      baseUrl: process.env.MOC_OAUTH_BASE_URL,
      clientId: process.env.MOC_OAUTH_CLIENT_ID,
      clientSecret: process.env.MOC_OAUTH_CLIENT_SECRET,
      redirectUri: process.env.MOC_OAUTH_REDIRECT_URI,
    });
  }
  return client;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
}

export type PkceChallenge = {
  state: string;
  codeChallenge: string;
  // Signed { nonce, codeVerifier } — stored in an httpOnly cookie between the
  // login redirect and the callback, so any API instance can finish the flow.
  pkceCookie: string;
};

export function createPkceChallenge(): PkceChallenge {
  const nonce = crypto.randomBytes(16).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  const secret = getJwtSecret();

  return {
    state: jwt.sign({ nonce }, secret, { expiresIn: PKCE_TTL_SECONDS }),
    codeChallenge,
    pkceCookie: jwt.sign({ nonce, codeVerifier }, secret, { expiresIn: PKCE_TTL_SECONDS }),
  };
}

// Returns the code_verifier only if the state returned by AAS matches the
// nonce this browser was issued at login time.
export function resolveCodeVerifier(state: string, pkceCookie: string | undefined): string | null {
  if (!pkceCookie) return null;
  try {
    const secret = getJwtSecret();
    const fromState = jwt.verify(state, secret) as { nonce?: string };
    const fromCookie = jwt.verify(pkceCookie, secret) as { nonce?: string; codeVerifier?: string };
    if (!fromState.nonce || fromState.nonce !== fromCookie.nonce || !fromCookie.codeVerifier) return null;
    return fromCookie.codeVerifier;
  } catch {
    return null;
  }
}
