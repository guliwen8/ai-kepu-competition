import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, name: string) {
    const team = await this.prisma.team.create({
      data: {
        name,
        ownerId,
        members: {
          create: [{ userId: ownerId, role: 'owner' }],
        },
      },
      include: { members: true },
    });
    return team;
  }

  async addMember(ownerId: string, teamId: string, phone: string, role?: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });
    if (!team) throw new NotFoundException('团队不存在');
    if (team.ownerId !== ownerId) throw new ForbiddenException();

    if (team.members.length >= 10) {
      throw new BadRequestException('团队人数已达上限');
    }

    const user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) throw new BadRequestException('用户不存在');

    const exists = team.members.some((m) => m.userId === user.id);
    if (exists) throw new BadRequestException('该用户已在团队中');

    return this.prisma.teamMember.create({
      data: {
        teamId,
        userId: user.id,
        role: role ?? 'member',
      },
    });
  }

  async myTeams(userId: string) {
    const teams = await this.prisma.team.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      include: { members: true },
      orderBy: { createdAt: 'desc' },
    });
    return teams;
  }
}

