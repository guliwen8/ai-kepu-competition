"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { labelCategory } from "@/lib/labels";

type Item = {
  rank: number;
  submissionId: string;
  blindCode: string;
  title: string | null;
  category: string;
  score: { avgTotal: number; scoreCount: number; avgS1: number; avgS2: number; avgS3: number; avgS4: number; avgS5: number };
};

type Resp = {
  competition: { id: string; title: string; phase: string };
  total: number;
  page: number;
  pageSize: number;
  minScoreCount: number;
  items: Item[];
};

const categories = [
  { label: "科普剧", value: "DRAMA" },
  { label: "科普视频", value: "VIDEO" },
  { label: "科幻画", value: "SCIFI_PAINT" },
  { label: "创意作品", value: "CREATIVE_APP" },
];

export default function RankingPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
  const [category, setCategory] = useState("VIDEO");
  const [data, setData] = useState<Resp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const exportUrl = useMemo(() => `${apiBase}/admin/publications/export?category=${encodeURIComponent(category)}`, [apiBase, category]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    apiFetch<Resp>(`/admin/publications/leaderboard?category=${encodeURIComponent(category)}&page=1&pageSize=100`)
      .then((d) => {
        if (!mounted) return;
        setData(d);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "加载失败");
        setData(null);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [category]);

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-zinc-900">公示榜单</h1>
            <p className="text-sm text-zinc-600">仅统计已公示作品（PUBLICIZED），按平均分排名</p>
          </div>
          <Link className="text-sm text-zinc-700 hover:text-zinc-900" href="/dashboard">
            返回仪表盘
          </Link>
        </div>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <a
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                href={exportUrl}
                target="_blank"
                rel="noreferrer"
              >
                导出 CSV
              </a>
            </div>
            <div className="text-sm text-zinc-600">
              {data ? (
                <span>
                  当前赛事：{data.competition.title} · 入榜最低提交数：{data.minScoreCount}
                </span>
              ) : null}
            </div>
          </div>

          {error ? <div className="mt-4 text-sm text-red-600 break-words">{error}</div> : null}
          {loading ? <div className="mt-4 text-sm text-zinc-600">加载中...</div> : null}

          {data ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-600 border-b">
                    <th className="py-2 pr-4">排名</th>
                    <th className="py-2 pr-4">盲评码</th>
                    <th className="py-2 pr-4">标题</th>
                    <th className="py-2 pr-4">类别</th>
                    <th className="py-2 pr-4">平均分</th>
                    <th className="py-2 pr-4">提交数</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((it) => (
                    <tr key={it.submissionId} className="border-b last:border-b-0">
                      <td className="py-3 pr-4 font-medium text-zinc-900">#{it.rank}</td>
                      <td className="py-3 pr-4 text-zinc-700">{it.blindCode}</td>
                      <td className="py-3 pr-4 text-zinc-900">{it.title ?? "-"}</td>
                      <td className="py-3 pr-4 text-zinc-700">{labelCategory(it.category)}</td>
                      <td className="py-3 pr-4 text-zinc-900">{it.score.avgTotal}</td>
                      <td className="py-3 pr-4 text-zinc-700">{it.score.scoreCount}</td>
                    </tr>
                  ))}
                  {data.items.length === 0 ? (
                    <tr>
                      <td className="py-6 text-center text-zinc-600" colSpan={6}>
                        暂无已公示作品
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

