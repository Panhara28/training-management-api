import jwt from 'jsonwebtoken';

export const ACCESS_COOKIE = 'staff_session';
export const REFRESH_COOKIE = 'staff_refresh';
export const ACCESS_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return secret;
}

export type StaffAccessPayload = { sub: string; staffRoleId: string | null };
export type StaffRefreshPayload = { sub: string };

// Tokens issued before ids became UUIDs carry a numeric `sub`; treat them as
// invalid so their holders are asked to sign in again.
function hasUserId(payload: unknown): payload is { sub: string } {
  return typeof (payload as { sub?: unknown } | null)?.sub === 'string';
}

export function signAccessToken(userId: string, staffRoleId: string | null): string {
  const payload: StaffAccessPayload = { sub: userId, staffRoleId };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: ACCESS_TTL_SECONDS });
}

export function signRefreshToken(userId: string): string {
  const payload: StaffRefreshPayload = { sub: userId };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: REFRESH_TTL_SECONDS });
}

export function verifyAccessToken(token: string | undefined): StaffAccessPayload | null {
  if (!token) return null;
  try {
    const payload: unknown = jwt.verify(token, getJwtSecret());
    return hasUserId(payload) ? (payload as StaffAccessPayload) : null;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string | undefined): StaffRefreshPayload | null {
  if (!token) return null;
  try {
    const payload: unknown = jwt.verify(token, getJwtSecret());
    return hasUserId(payload) ? payload : null;
  } catch {
    return null;
  }
}
