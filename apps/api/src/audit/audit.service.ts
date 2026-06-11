import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { getRequestContext } from '../request-context';

function csvEscape(v: unknown) {
  const s = String(v ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async write(args: {
    actorUserId?: string;
    actorRoles?: string[];
    action: string;
    resourceType: string;
    resourceId?: string;
    success?: boolean;
    requestId?: string;
    ip?: string;
    userAgent?: string;
    before?: any;
    after?: any;
  }) {
    const ctx = getRequestContext();
    await this.prisma.auditLog.create({
      data: {
        actorUserId: args.actorUserId ?? null,
        actorRoles: args.actorRoles?.join(',') ?? null,
        action: args.action,
        resourceType: args.resourceType,
        resourceId: args.resourceId ?? null,
        success: args.success ?? true,
        requestId: args.requestId ?? ctx?.requestId ?? null,
        ip: args.ip ?? null,
        userAgent: args.userAgent ?? null,
        before: args.before ?? undefined,
        after: args.after ?? undefined,
      },
    });
  }

  async list(args: {
    page: number;
    pageSize: number;
    action?: string;
    resourceType?: string;
    resourceId?: string;
    actorUserId?: string;
    sinceMinutes?: number;
  }) {
    const page = Math.max(1, Math.floor(args.page));
    const pageSize = Math.min(50, Math.max(1, Math.floor(args.pageSize)));
    const where: any = {};
    if (args.action) where.action = args.action;
    if (args.resourceType) where.resourceType = args.resourceType;
    if (args.resourceId) where.resourceId = args.resourceId;
    if (args.actorUserId) where.actorUserId = args.actorUserId;
    if (typeof args.sinceMinutes === 'number' && Number.isFinite(args.sinceMinutes) && args.sinceMinutes > 0) {
      where.createdAt = { gte: new Date(Date.now() - Math.floor(args.sinceMinutes) * 60 * 1000) };
    }
    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, items: rows };
  }

  async exportCsv(args: { action?: string; resourceType?: string; resourceId?: string; actorUserId?: string; sinceMinutes?: number }) {
    const where: any = {};
    if (args.action) where.action = args.action;
    if (args.resourceType) where.resourceType = args.resourceType;
    if (args.resourceId) where.resourceId = args.resourceId;
    if (args.actorUserId) where.actorUserId = args.actorUserId;
    if (typeof args.sinceMinutes === 'number' && Number.isFinite(args.sinceMinutes) && args.sinceMinutes > 0) {
      where.createdAt = { gte: new Date(Date.now() - Math.floor(args.sinceMinutes) * 60 * 1000) };
    }

    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const header = ['createdAt', 'actorUserId', 'actorRoles', 'action', 'resourceType', 'resourceId', 'success', 'ip', 'userAgent', 'requestId'];
    const lines = [header.join(',')];
    for (const r of rows) {
      lines.push(
        [
          csvEscape(r.createdAt.toISOString()),
          csvEscape(r.actorUserId ?? ''),
          csvEscape(r.actorRoles ?? ''),
          csvEscape(r.action),
          csvEscape(r.resourceType),
          csvEscape(r.resourceId ?? ''),
          csvEscape(r.success ? 'true' : 'false'),
          csvEscape(r.ip ?? ''),
          csvEscape(r.userAgent ?? ''),
          csvEscape(r.requestId ?? ''),
        ].join(','),
      );
    }
    return lines.join('\n');
  }
}
