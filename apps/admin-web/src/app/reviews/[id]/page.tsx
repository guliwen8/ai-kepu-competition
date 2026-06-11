"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { clearTokens } from "@/lib/auth";
import {
  labelCategory,
  labelReviewSummary,
  labelReviewTaskStatus,
  labelReviewTaskType,
  labelSubmissionStatus,
} from "@/lib/labels";

type ReviewTask = {
  id: string;
  type: string;
  status: string;
  findings: unknown;
};

type DetailResponse = {
  id: string;
  title: string;
  category: string;
  status: string;
  intro?: string | null;
  aiToolsUsage?: string | null;
  teacherName?: string | null;
  teacherContact?: string | null;
  createdAt: string;
  submittedAt: string | null;
  attachments: Array<{
    id: string;
    kind: string;
    originalName: string;
    mimeType: string | null;
    byteSize: number;
  }>;
  latestReview: null | {
    id: string;
    createdAt: string;
    summary: string;
    tasks: ReviewTask[];
  };
};

function statusBadge(status: string) {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium";
  if (status === "FAIL" || status === "NEED_FIX" || status === "REJECTED") return `${base} bg-red-100 text-red-700`;
  if (status === "PASS" || status === "APPROVED") return `${base} bg-emerald-100 text-emerald-700`;
  if (status === "NEED_MANUAL") return `${base} bg-amber-100 text-amber-700`;
  return `${base} bg-zinc-100 text-zinc-700`;
}

export default function ReviewDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [note, setNote] = useState("");

  const load = useMemo(() => async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const d = await apiFetch<DetailResponse>(`/admin/submissions/${id}`);
      setData(d);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载失败";
      setError(msg);
      if (msg.includes("401")) {
        clearTokens();
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function decision(decision: "APPROVE" | "NEED_FIX" | "REJECT") {
    if (!id) return;
    setActing(true);
    setError(null);
    try {
      await apiFetch(`/admin/submissions/${id}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision, note: note || undefined }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setActing(false);
    }
  }

  async function rerun(types: Array<"ANONYMITY" | "CONTENT">) {
    if (!id) return;
    setActing(true);
    setError(null);
    try {
      await apiFetch(`/admin/submissions/${id}/rerun`, {
        method: "POST",
        body: JSON.stringify({ types }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "重跑失败");
    } finally {
      setActing(false);
    }
  }

  async function publicize(enabled: boolean) {
    setActing(true);
    setError(null);
    try {
      await apiFetch(`/admin/submissions/${id}/${enabled ? "publicize" : "unpublicize"}`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-zinc-900">复核详情</h1>
            <div className="text-sm text-zinc-600">{id}</div>
          </div>
          <Link className="text-sm text-zinc-700 hover:text-zinc-900" href="/reviews">
            返回列表
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            {error ? <div className="text-sm text-red-600 break-words">{error}</div> : null}
            {loading ? <div className="text-sm text-zinc-600">加载中...</div> : null}
            {data ? (
              <div className="space-y-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-zinc-900 font-semibold">{data.title}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <span className={statusBadge(data.category)}>{labelCategory(data.category)}</span>
                      <span className={statusBadge(data.status)}>{labelSubmissionStatus(data.status)}</span>
                      {data.latestReview ? (
                        <span className={statusBadge(data.latestReview.summary)}>{labelReviewSummary(data.latestReview.summary)}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-md bg-zinc-900 text-white px-3 py-2 text-sm disabled:opacity-60"
                      disabled={acting}
                      onClick={() => decision("APPROVE")}
                    >
                      通过
                    </button>
                    <button
                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                      disabled={acting}
                      onClick={() => decision("NEED_FIX")}
                    >
                      退回修改
                    </button>
                    <button
                      className="rounded-md border border-red-300 bg-white text-red-700 px-3 py-2 text-sm disabled:opacity-60"
                      disabled={acting}
                      onClick={() => decision("REJECT")}
                    >
                      拒绝
                    </button>
                    {data.status === "PUBLICIZED" ? (
                      <button
                        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                        disabled={acting}
                        onClick={() => publicize(false)}
                      >
                        取消公示
                      </button>
                    ) : (
                      <button
                        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                        disabled={acting}
                        onClick={() => publicize(true)}
                      >
                        公示
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <div className="text-zinc-900 font-medium">内容字段</div>
                    <div className="mt-2 space-y-2 text-zinc-700">
                      <div>
                        <div className="text-xs text-zinc-500">简介</div>
                        <div className="whitespace-pre-wrap break-words">{data.intro ?? "-"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-zinc-500">AI 工具说明</div>
                        <div className="whitespace-pre-wrap break-words">{data.aiToolsUsage ?? "-"}</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                    <div className="text-zinc-900 font-medium">附件</div>
                    <div className="mt-2 space-y-2 text-zinc-700">
                      {data.attachments.length ? (
                        data.attachments.map((a) => (
                          <div key={a.id} className="flex items-center justify-between gap-2">
                            <div className="truncate">
                              <div className="text-xs text-zinc-500">
                                {a.kind} · {a.mimeType ?? "-"}
                              </div>
                              <div className="truncate">{a.originalName}</div>
                            </div>
                            <div className="text-xs text-zinc-500">{Math.round(a.byteSize / 1024)} KB</div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-zinc-600">无附件</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-zinc-900 font-medium">重跑审核</div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                        disabled={acting}
                        onClick={() => rerun(["ANONYMITY"])}
                      >
                        重跑匿名
                      </button>
                      <button
                        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                        disabled={acting}
                        onClick={() => rerun(["CONTENT"])}
                      >
                        重跑内容
                      </button>
                      <button
                        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                        disabled={acting}
                        onClick={() => rerun(["ANONYMITY", "CONTENT"])}
                      >
                        重跑匿名+内容
                      </button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="text-xs text-zinc-500">复核备注（人工判定时可填写）</div>
                    <textarea
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/20"
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="例如：请删除单位/手机号信息；或说明拒绝原因"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-white p-3">
                  <div className="text-zinc-900 font-medium">最新审核任务</div>
                  {data.latestReview ? (
                    <div className="mt-3 space-y-3">
                      {data.latestReview.tasks.map((t) => (
                        <div key={t.id} className="rounded-md border border-zinc-200 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={statusBadge(t.type)}>{labelReviewTaskType(t.type)}</span>
                              <span className={statusBadge(t.status)}>{labelReviewTaskStatus(t.status)}</span>
                            </div>
                          </div>
                          <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-md p-2">
                            {JSON.stringify(t.findings ?? null, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-sm text-zinc-600">暂无审核记录</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
