"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { labelCategory } from "@/lib/labels";

type MeResponse = { roles: string[] };

type AssignmentItem = {
  id: string;
  status: string;
  lockedAt: string | null;
  submission: { id: string; blindCode: string | null; category: string; title: string };
  score: { total: number } | null;
};

export default function JudgeTasksPage() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState(false);

  const canJudge = useMemo(() => Boolean(me?.roles?.includes("judge")), [me?.roles]);

  useEffect(() => {
    apiFetch<{ roles: string[] }>("/auth/me")
      .then((data) => setMe({ roles: data.roles }))
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  async function load() {
    if (!canJudge) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<any[]>("/judge/judging/assignments");
      setItems(
        data.map((a) => ({
          id: a.id,
          status: a.status,
          lockedAt: a.lockedAt,
          submission: {
            id: a.submission.id,
            blindCode: a.submission.blindCode,
            category: a.submission.category,
            title: a.submission.title,
          },
          score: a.score ? { total: a.score.total } : null,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canJudge) void load();
  }, [canJudge]);

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-zinc-900">评委任务</h1>
          <div className="flex gap-2">
            <Link className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm" href="/dashboard">
              返回
            </Link>
            <button
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
              onClick={load}
              disabled={loading}
            >
              {loading ? "刷新中..." : "刷新"}
            </button>
          </div>
        </div>

        {!canJudge ? (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
            需要 judge 角色
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
            {error ? <div className="text-sm text-red-600 break-words">{error}</div> : null}
            {items.length === 0 && !error ? <div className="text-sm text-zinc-600">暂无任务</div> : null}
            <div className="divide-y divide-zinc-200">
              {items.map((it) => (
                <div key={it.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-zinc-900 truncate">
                      {it.submission.blindCode ?? "-"} · {it.submission.title}
                    </div>
                    <div className="text-xs text-zinc-600">
                      {labelCategory(it.submission.category)} · 状态：{it.status} · 总分：{it.score?.total ?? "-"}
                    </div>
                  </div>
                  <Link className="rounded-md bg-zinc-900 text-white px-3 py-2 text-sm" href={`/judge/${it.id}`}>
                    打分
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

