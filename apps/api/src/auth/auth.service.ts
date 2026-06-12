import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginPasswordDto } from './dto/login-password.dto';
import { LoginSmsDto } from './dto/login-sms.dto';
import { RegisterDto } from './dto/register.dto';

type Tokens = {
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private accessSecret() {
    return this.configService.get<string>('JWT_ACCESS_SECRET') ?? 'changeme';
  }

  private refreshSecret() {
    return this.configService.get<string>('JWT_REFRESH_SECRET') ?? 'changeme';
  }

  private async ensureRole(code: string, name: string) {
    return this.prisma.role.upsert({
      where: { code },
      update: {},
      create: { code, name },
    });
  }

  private async getUserRoles(userId: string) {
    const rows = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true },
    });
    return rows.map((r) => r.role.code);
  }

  private async issueTokens(userId: string): Promise<Tokens> {
    const roles = await this.getUserRoles(userId);
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, roles },
      { secret: this.accessSecret(), expiresIn: '15m' },
    );
    const refreshToken = await this.jwtService.signAsync(
      { sub: userId },
      { secret: this.refreshSecret(), expiresIn: '30d' },
    );

    const decoded = this.jwtService.decode(refreshToken);
    const expiresAt =
      decoded?.exp != null
        ? new Date(decoded.exp * 1000)
        : new Date(Date.now() + 30 * 86400_000);

    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        expiresAt,
        tokenHash,
      },
    });

    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto): Promise<Tokens> {
    if (!dto.username && !dto.phone) {
      throw new BadRequestException('username 或 phone 不能为空');
    }

    if (dto.username) {
      const exists = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (exists) {
        throw new BadRequestException('username 已存在');
      }
    }

    if (dto.phone) {
      const exists = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (exists) {
        throw new BadRequestException('phone 已存在');
      }
    }

    const participant = await this.ensureRole('participant', '参赛者');
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        phone: dto.phone,
        passwordHash,
        userRoles: {
          create: [{ roleId: participant.id }],
        },
      },
    });

    return this.issueTokens(user.id);
  }

  async loginPassword(dto: LoginPasswordDto): Promise<Tokens> {
    const user =
      (await this.prisma.user.findUnique({
        where: { username: dto.identity },
      })) ??
      (await this.prisma.user.findUnique({ where: { email: dto.identity } })) ??
      (await this.prisma.user.findUnique({ where: { phone: dto.identity } }));

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('账号或密码错误');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('账号或密码错误');
    }

    return this.issueTokens(user.id);
  }

  async loginSms(dto: LoginSmsDto): Promise<Tokens> {
    if (dto.code !== '000000') {
      throw new UnauthorizedException('验证码错误');
    }

    const participant = await this.ensureRole('participant', '参赛者');

    const user =
      (await this.prisma.user.findUnique({ where: { phone: dto.phone } })) ??
      (await this.prisma.user.create({
        data: {
          phone: dto.phone,
          userRoles: {
            create: [{ roleId: participant.id }],
          },
        },
      }));

    return this.issueTokens(user.id);
  }

  async refresh(refreshToken: string): Promise<Tokens> {
    let payload: { sub: string };
    try {
      payload = await this.jwtService.verifyAsync<{ sub: string }>(
        refreshToken,
        {
          secret: this.refreshSecret(),
        },
      );
    } catch {
      throw new UnauthorizedException('refresh token 无效');
    }

    const tokenRow = await this.prisma.refreshToken.findFirst({
      where: {
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!tokenRow) {
      throw new UnauthorizedException('refresh token 无效');
    }

    const ok = await bcrypt.compare(refreshToken, tokenRow.tokenHash);
    if (!ok) {
      throw new UnauthorizedException('refresh token 无效');
    }

    return this.issueTokens(payload.sub);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        username: true,
        status: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    const roles = await this.getUserRoles(userId);
    return { ...user, roles };
  }
}
