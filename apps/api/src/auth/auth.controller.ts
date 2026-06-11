import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { createHash } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { AuthService } from './auth.service';
import { LoginPasswordDto } from './dto/login-password.dto';
import { LoginSmsDto } from './dto/login-sms.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
    private readonly jwtService: JwtService,
  ) {}

  private hashIdentifier(v?: string | null) {
    if (!v) return null;
    const h = createHash('sha256').update(String(v)).digest('hex');
    return h.slice(0, 24);
  }

  private async safeAuditWrite(args: Parameters<AuditService['write']>[0]) {
    try {
      await this.auditService.write(args);
    } catch {}
  }

  @Post('register')
  async register(@Req() req: any, @Body() dto: RegisterDto) {
    try {
      const tokens = await this.authService.register(dto);
      const payload = this.jwtService.decode(tokens.accessToken) as any;
      const userId = typeof payload?.sub === 'string' ? payload.sub : null;
      const roles = Array.isArray(payload?.roles) ? payload.roles : undefined;
      await this.safeAuditWrite({
        actorUserId: userId ?? undefined,
        actorRoles: roles,
        action: 'AUTH_REGISTER',
        resourceType: 'User',
        resourceId: userId ?? undefined,
        success: true,
        after: {
          userId,
          usernameHash: this.hashIdentifier((dto as any)?.username),
          phoneHash: this.hashIdentifier((dto as any)?.phone),
        },
        ip: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
      return tokens;
    } catch (e) {
      await this.safeAuditWrite({
        action: 'AUTH_REGISTER',
        resourceType: 'User',
        success: false,
        after: {
          usernameHash: this.hashIdentifier((dto as any)?.username),
          phoneHash: this.hashIdentifier((dto as any)?.phone),
        },
        ip: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
      throw e;
    }
  }

  @Post('login/password')
  async loginPassword(@Req() req: any, @Body() dto: LoginPasswordDto) {
    try {
      const tokens = await this.authService.loginPassword(dto);
      const payload = this.jwtService.decode(tokens.accessToken) as any;
      const userId = typeof payload?.sub === 'string' ? payload.sub : null;
      const roles = Array.isArray(payload?.roles) ? payload.roles : undefined;
      await this.safeAuditWrite({
        actorUserId: userId ?? undefined,
        actorRoles: roles,
        action: 'AUTH_LOGIN_PASSWORD',
        resourceType: 'User',
        resourceId: userId ?? undefined,
        success: true,
        after: {
          userId,
          identityHash: this.hashIdentifier((dto as any)?.identity),
        },
        ip: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
      return tokens;
    } catch (e) {
      await this.safeAuditWrite({
        action: 'AUTH_LOGIN_PASSWORD',
        resourceType: 'User',
        success: false,
        after: {
          identityHash: this.hashIdentifier((dto as any)?.identity),
        },
        ip: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
      throw e;
    }
  }

  @Post('login/sms')
  async loginSms(@Req() req: any, @Body() dto: LoginSmsDto) {
    try {
      const tokens = await this.authService.loginSms(dto);
      const payload = this.jwtService.decode(tokens.accessToken) as any;
      const userId = typeof payload?.sub === 'string' ? payload.sub : null;
      const roles = Array.isArray(payload?.roles) ? payload.roles : undefined;
      await this.safeAuditWrite({
        actorUserId: userId ?? undefined,
        actorRoles: roles,
        action: 'AUTH_LOGIN_SMS',
        resourceType: 'User',
        resourceId: userId ?? undefined,
        success: true,
        after: {
          userId,
          phoneHash: this.hashIdentifier((dto as any)?.phone),
        },
        ip: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
      return tokens;
    } catch (e) {
      await this.safeAuditWrite({
        action: 'AUTH_LOGIN_SMS',
        resourceType: 'User',
        success: false,
        after: {
          phoneHash: this.hashIdentifier((dto as any)?.phone),
        },
        ip: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
      throw e;
    }
  }

  @Post('refresh')
  async refresh(@Req() req: any, @Body() dto: RefreshDto) {
    const payload = this.jwtService.decode(dto.refreshToken) as any;
    const userId = typeof payload?.sub === 'string' ? payload.sub : null;
    try {
      const tokens = await this.authService.refresh(dto.refreshToken);
      const accessPayload = this.jwtService.decode(tokens.accessToken) as any;
      const roles = Array.isArray(accessPayload?.roles) ? accessPayload.roles : undefined;
      await this.safeAuditWrite({
        actorUserId: userId ?? undefined,
        actorRoles: roles,
        action: 'AUTH_REFRESH',
        resourceType: 'User',
        resourceId: userId ?? undefined,
        success: true,
        after: { userId },
        ip: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
      return tokens;
    } catch (e) {
      await this.safeAuditWrite({
        actorUserId: userId ?? undefined,
        action: 'AUTH_REFRESH',
        resourceType: 'User',
        resourceId: userId ?? undefined,
        success: false,
        after: { userId },
        ip: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
      throw e;
    }
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: { user?: { userId: string } }) {
    return this.authService.me(req.user!.userId);
  }
}
