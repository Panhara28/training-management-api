import { Body, Controller, Get, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import type { AuthenticatedStaff } from '../common/interfaces/authenticated-staff.interface';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_TTL_SECONDS,
  REFRESH_TTL_SECONDS,
  verifyAccessToken,
} from '../lib/staff-jwt';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '../lib/portal-session';
import { createPkceChallenge, getMocOAuthClient, PKCE_COOKIE, PKCE_COOKIE_PATH, PKCE_TTL_SECONDS } from '../lib/moc-oauth';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MocOauthCallbackDto } from './dto/moc-oauth-callback.dto';

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private cookieOptions(maxAgeSeconds: number) {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: maxAgeSeconds * 1000,
    };
  }

  @Post('login')
  @ApiOperation({ summary: 'Staff login' })
  @ApiOkResponse({ description: '{ user }' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: LoginDto) {
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const { accessToken, refreshToken, user } = await this.authService.login(body.username, body.password, ip);

    res.cookie(ACCESS_COOKIE, accessToken, this.cookieOptions(ACCESS_TTL_SECONDS));
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions(REFRESH_TTL_SECONDS));

    return user;
  }

  // AAS login, step 1 — the browser navigates here directly (not fetch) and
  // is 302'd on to the AAS identity provider.
  @Get('moc-oauth/login')
  @ApiOperation({ summary: 'Start AAS (MOC OAuth) login — redirects to AAS' })
  async mocOauthLogin(@Res() res: Response) {
    try {
      const { state, codeChallenge, pkceCookie } = createPkceChallenge();
      const result = await getMocOAuthClient().getLoginToken({ state, codeChallenge, codeChallengeMethod: 'S256' });
      if (!result.success) throw new Error(result.error?.message || 'Unable to reach AAS login');

      res.cookie(PKCE_COOKIE, pkceCookie, { ...this.cookieOptions(PKCE_TTL_SECONDS), path: PKCE_COOKIE_PATH });
      return res.redirect(result.data.redirectUri);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reach AAS login';
      const params = new URLSearchParams({ error: 'aas_unavailable', error_description: message });
      return res.redirect(`/auth/callback?${params.toString()}`);
    }
  }

  // AAS login, step 2 — the frontend /auth/callback page POSTs the
  // { code, state } AAS redirected back with.
  @Post('moc-oauth/callback')
  @ApiOperation({ summary: 'Complete AAS (MOC OAuth) login' })
  @ApiOkResponse({ description: '{ user }' })
  async mocOauthCallback(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: MocOauthCallbackDto,
  ) {
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const pkceCookie = (req as Request & { cookies?: Record<string, string> }).cookies?.[PKCE_COOKIE];
    // One-time use regardless of outcome.
    res.cookie(PKCE_COOKIE, '', { ...this.cookieOptions(0), path: PKCE_COOKIE_PATH });

    const result = await this.authService.mocOauthLogin(body.code, body.state, pkceCookie, ip);

    if (result.kind === 'portal') {
      res.cookie(SESSION_COOKIE, result.portalToken, this.cookieOptions(SESSION_MAX_AGE_SECONDS));
    } else {
      res.cookie(ACCESS_COOKIE, result.accessToken, this.cookieOptions(ACCESS_TTL_SECONDS));
      res.cookie(REFRESH_COOKIE, result.refreshToken, this.cookieOptions(REFRESH_TTL_SECONDS));
    }

    return result.user;
  }

  @Post('logout')
  @ApiOperation({ summary: 'Staff logout' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.cookie(ACCESS_COOKIE, '', this.cookieOptions(0));
    res.cookie(REFRESH_COOKIE, '', this.cookieOptions(0));
    return { ok: true };
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = (req as Request & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE];
    const { accessToken } = await this.authService.refresh(refreshToken);
    res.cookie(ACCESS_COOKIE, accessToken, this.cookieOptions(ACCESS_TTL_SECONDS));
    return { ok: true };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current staff user + permissions' })
  async me(@Req() req: Request) {
    const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[ACCESS_COOKIE];
    const payload = verifyAccessToken(token);
    return this.authService.me(payload?.sub ?? null);
  }

  @Patch('change-password')
  @UseGuards(StaffAuthGuard)
  @ApiOperation({ summary: 'Change own password' })
  changePassword(@CurrentStaff() staff: AuthenticatedStaff, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(staff, body);
  }
}
