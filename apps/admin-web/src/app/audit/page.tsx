'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

type AuditItem = {
  id: string;
  createdAt: string;
  actorUserId: string | null;
  actorRoles: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  success: boolean;
  requestId: string | null;
  ip: string | null;
  userAgent: string | null;
};

type Resp = { total: number; page: number; pageSize: number; items: AuditItem[] };

export default function AuditPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [action, setAction] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [actorUserId, setActorUserId] = useState('');
  const [sinceMinutes, setSinceMinutes] = useState('1440');
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const actionOptions = useMemo(
    () => [
      'ADMIN_COMPETITION_CREATE',
      'ADMIN_COMPETITION_UPDATE',
      'ADMIN_COMPETITION_SET_CURRENT',
      'ADMIN_JUDGE_GRANT',
      'ADMIN_JUDGING_ASSIGN_BATCH',
      'ADMIN_JUDGING_REVOKE',
      'ADMIN_JUDGING_EXPORT',
      'ADMIN_AUDIT_EXPORT',
      'PARTICIPANT_SUBMISSION_CREATE_DRAFT',
      'PARTICIPANT_SUBMISSION_UPDATE_DRAFT',
      'PARTICIPANT_SUBMISSION_UPLOAD_ATTACHMENT',
      'PARTICIPANT_SUBMISSION_SUBMIT',
      'PARTICIPANT_TEAM_CREATE',
      'PARTICIPANT_TEAM_ADD_MEMBER',
      'AUTH_REGISTER',
      'AUTH_LOGIN_PASSWORD',
      'AUTH_LOGIN_SMS',
      'AUTH_REFRESH',
    ],
    [],
  );
  const resourceTypeOptions = useMemo(
    () => [
      'Competition',
      'Judge',
      'JudgingAssignment',
      'JudgingExport',
      'Submission',
      'Team',
      'AuditLog',
      'User',
    ],
    [],
  );
  const sinceOptions = useMemo(() => ['60', '1440', '10080'], []);

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set('page', String(page));
    sp.set('pageSize', String(pageSize));
    if (action.trim()) sp.set('action', action.trim());
    if (resourceType.trim()) sp.set('resourceType', resourceType.trim());
    if (resourceId.trim()) sp.set('resourceId', resourceId.trim());
    if (actorUserId.trim()) sp.set('actorUserId', actorUserId.trim());
    if (sinceMinutes.trim()) sp.set('sinceMinutes', sinceMinutes.trim());
    return sp.toString();
  }, [action, actorUserId, page, pageSize, resourceId, resourceType, sinceMinutes]);

  const exportUrl = useMemo(() => `${apiBase}/admin/audit-logs/export?${qs}`, [apiBase, qs]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    apiFetch<Resp>(`/admin/audit-logs?${qs}`)
      .then((d) => {
        if (!mounted) return;
        setData(d);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : '加载失败');
        setData(null);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [qs]);

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-zinc-900">审计日志</h1>
            <p className="text-sm text-zinc-600">支持筛选与导出（导出不包含 before/after）</p>
          </div>
          <Link className="text-sm text-zinc-700 hover:text-zinc-900" href="/dashboard">
            返回仪表盘
          </Link>
        </div>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              value={action}
              onChange={(e) => {
                setPage(1);
                setAction(e.target.value);
              }}
              list="audit-action-options"
              placeholder="action（如 ADMIN_JUDGING_EXPORT）"
            />
            <datalist id="audit-action-options">
              {actionOptions.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
            <input
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              value={resourceType}
              onChange={(e) => {
                setPage(1);
                setResourceType(e.target.value);
              }}
              list="audit-resource-type-options"
              placeholder="resourceType（如 Submission）"
            />
            <datalist id="audit-resource-type-options">
              {resourceTypeOptions.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
            <input
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              value={resourceId}
              onChange={(e) => {
                setPage(1);
                setResourceId(e.target.value);
              }}
              placeholder="resourceId"
            />
            <input
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              value={actorUserId}
              onChange={(e) => {
                setPage(1);
                setActorUserId(e.target.value);
              }}
              placeholder="actorUserId"
            />
            <input
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
              value={sinceMinutes}
              onChange={(e) => {
                setPage(1);
                setSinceMinutes(e.target.value);
              }}
              list="audit-since-options"
              placeholder="sinceMinutes（如 60）"
            />
            <datalist id="audit-since-options">
              {sinceOptions.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
            <a
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-center"
              href={exportUrl}
              target="_blank"
              rel="noreferrer"
            >
              导出 CSV
            </a>
          </div>

          {error ? <div className="mt-4 text-sm text-red-600 break-words">{error}</div> : null}
          {loading ? <div className="mt-4 text-sm text-zinc-600">加载中...</div> : null}

          {data ? (
            <div className="mt-4 overflow-x-auto">
              <div className="text-sm text-zinc-600">
                total={data.total} · page={data.page}
              </div>
              <table className="min-w-full text-sm mt-3">
                <thead>
                  <tr className="text-left text-zinc-600 border-b">
                    <th className="py-2 pr-4">时间</th>
                    <th className="py-2 pr-4">action</th>
                    <th className="py-2 pr-4">resource</th>
                    <th className="py-2 pr-4">actor</th>
                    <th className="py-2 pr-4">success</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it) => (
                    <tr key={it.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-4 text-zinc-700 whitespace-nowrap">
                        {new Date(it.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 pr-4 text-zinc-900">{it.action}</td>
                      <td className="py-3 pr-4 text-zinc-700">
                        {it.resourceType}
                        {it.resourceId ? (
                          <>
                            <span className="text-zinc-400">:</span>
                            <button
                              type="button"
                              className="ml-1 text-zinc-700 hover:text-zinc-900 underline underline-offset-2"
                              title={it.resourceId}
                              onClick={() => navigator.clipboard?.writeText(it.resourceId ?? '')}
                            >
                              {it.resourceId}
                            </button>
                          </>
                        ) : (
                          ''
                        )}
                      </td>
                      <td className="py-3 pr-4 text-zinc-700">{it.actorUserId ?? '-'}</td>
                      <td className="py-3 pr-4 text-zinc-700">{it.success ? 'true' : 'false'}</td>
                    </tr>
                  ))}
                  {data.items.length === 0 ? (
                    <tr>
                      <td className="py-6 text-center text-zinc-600" colSpan={5}>
                        无数据
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>

              <div className="mt-4 flex items-center gap-2">
                <button
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  上一页
                </button>
                <button
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                  disabled={data.items.length < pageSize}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
