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

export type StaffAccessPayload = { sub: number; staffRoleId: number | null };
export type StaffRefreshPayload = { sub: number };

export function signAccessToken(userId: number, staffRoleId: number | null): string {
  const payload: StaffAccessPayload = { sub: userId, staffRoleId };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: ACCESS_TTL_SECONDS });
}

export function signRefreshToken(userId: number): string {
  const payload: StaffRefreshPayload = { sub: userId };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: REFRESH_TTL_SECONDS });
}

export function verifyAccessToken(token: string | undefined): StaffAccessPayload | null {
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret()) as unknown as StaffAccessPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string | undefined): StaffRefreshPayload | null {
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret()) as unknown as StaffRefreshPayload;
  } catch {
    return null;
  }
}
