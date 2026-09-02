import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '../lib/portal-session';
import { PortalAuthService } from './portal-auth.service';
import { PortalLoginDto } from './dto/portal-login.dto';

@ApiTags('Portal Auth')
@Controller('api/portal/auth')
export class PortalAuthController {
  constructor(private readonly portalAuthService: PortalAuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Participant login' })
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: PortalLoginDto) {
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const { token, user } = await this.portalAuthService.login(body.username, body.password, ip);

    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS * 1000,
    });

    return user;
  }

  @Post('logout')
  @ApiOperation({ summary: 'Participant logout' })
  logout(@Res({ passthrough: true }) res: Response) {
    res.cookie(SESSION_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return { ok: true };
  }
}
