"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { clearTokens } from "@/lib/auth";
import {
  labelCategory,
  labelReviewSummary,
  labelReviewTaskStatus,
  labelReviewTaskType,
  labelSubmissionStatus,
} from "@/lib/labels";

type TaskBrief = { type: string; status: string };

type ListItem = {
  id: string;
  title: string;
  category: string;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  latestReview: null | {
    id: string;
    createdAt: string;
    summary: string;
    tasks: TaskBrief[];
  };
};

type ListResponse = {
  total: number;
  page: number;
  pageSize: number;
  items: ListItem[];
};

function statusBadge(status: string) {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
  if (status === "FAIL" || status === "NEED_FIX" || status === "REJECTED") return `${base} bg-red-100 text-red-700`;
  if (status === "PASS" || status === "APPROVED") return `${base} bg-emerald-100 text-emerald-700`;
  if (status === "NEED_MANUAL") return `${base} bg-amber-100 text-amber-700`;
  return `${base} bg-zinc-100 text-zinc-700`;
}

export default function ReviewsClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const page = Number(params.get("page") ?? "1");
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(Number.isFinite(page) && page > 0 ? page : 1));
    sp.set("pageSize", "20");
    if (q) sp.set("q", q);
    if (status) sp.set("status", status);
    return sp.toString();
  }, [page, q, status]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    apiFetch<ListResponse>(`/admin/submissions?${queryString}`)
      .then((d) => {
        if (!mounted) return;
        setData(d);
      })
      .catch((e) => {
        if (!mounted) return;
        const msg = e instanceof Error ? e.message : "加载失败";
        setError(msg);
        if (msg.includes("401")) {
          clearTokens();
          router.push("/login");
        }
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [queryString, router]);

  function go(next: { page?: number; q?: string; status?: string }) {
    const sp = new URLSearchParams();
    sp.set("page", String(next.page ?? page ?? 1));
    if (next.q != null ? next.q : q) sp.set("q", next.q != null ? next.q : q);
    if (next.status != null ? next.status : status) sp.set("status", next.status != null ? next.status : status);
    router.push(`/reviews?${sp.toString()}`);
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-zinc-900">审核复核</h1>
            <p className="text-sm text-zinc-600">查看作品最新审核结果、人工判定、重跑审核</p>
          </div>
          <Link className="text-sm text-zinc-700 hover:text-zinc-900" href="/dashboard">
            返回仪表盘
          </Link>
        </div>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-2">
              <input
                className="w-full md:w-72 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/20"
                value={q}
                onChange={(e) => go({ page: 1, q: e.target.value })}
                placeholder="搜索标题或 ID"
              />
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                value={status}
                onChange={(e) => go({ page: 1, status: e.target.value })}
              >
                <option value="">全部状态</option>
                <option value="DRAFT">草稿</option>
                <option value="SUBMITTED">已提交</option>
                <option value="UNDER_REVIEW">审核中</option>
                <option value="NEED_FIX">需修改</option>
                <option value="APPROVED">已通过</option>
                <option value="IN_JUDGING">评审中</option>
                <option value="PUBLICIZED">公示中</option>
                <option value="ARCHIVED">已归档</option>
                <option value="REJECTED">已拒绝</option>
              </select>
            </div>
            <div className="text-sm text-zinc-600">total={data?.total ?? "-"}</div>
          </div>

          {error ? <div className="mt-4 text-sm text-red-600 break-words">{error}</div> : null}
          {loading ? <div className="mt-4 text-sm text-zinc-600">加载中...</div> : null}

          {data ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-600 border-b">
                    <th className="py-2 pr-4">标题</th>
                    <th className="py-2 pr-4">类别</th>
                    <th className="py-2 pr-4">状态</th>
                    <th className="py-2 pr-4">最新审核</th>
                    <th className="py-2 pr-4">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it) => (
                    <tr key={it.id} className="border-b last:border-b-0">
                      <td className="py-3 pr-4 text-zinc-900">
                        <div className="font-medium">{it.title}</div>
                        <div className="text-xs text-zinc-500">{it.id}</div>
                      </td>
                      <td className="py-3 pr-4 text-zinc-700">{labelCategory(it.category)}</td>
                      <td className="py-3 pr-4">
                        <span className={statusBadge(it.status)}>{labelSubmissionStatus(it.status)}</span>
                      </td>
                      <td className="py-3 pr-4 text-zinc-700">
                        {it.latestReview ? (
                          <div className="space-y-1">
                            <div className="text-xs">
                              {labelReviewSummary(it.latestReview.summary)} ·{" "}
                              {new Date(it.latestReview.createdAt).toLocaleString()}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {it.latestReview.tasks.map((t) => (
                                <span key={t.type} className={statusBadge(t.status)}>
                                  {labelReviewTaskType(t.type)}:{labelReviewTaskStatus(t.status)}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <Link className="text-zinc-900 hover:underline" href={`/reviews/${it.id}`}>
                          打开
                        </Link>
                      </td>
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
                  onClick={() => go({ page: Math.max(1, page - 1) })}
                >
                  上一页
                </button>
                <button
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                  disabled={(data?.items?.length ?? 0) < 20}
                  onClick={() => go({ page: page + 1 })}
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

