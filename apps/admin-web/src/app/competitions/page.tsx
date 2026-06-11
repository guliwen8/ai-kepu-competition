"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

type Competition = {
  id: string;
  title: string;
  theme: string | null;
  isCurrent: boolean;
  submissionStart: string | null;
  submissionEnd: string | null;
  judgingStart: string | null;
  judgingEnd: string | null;
  publicStart: string | null;
  publicEnd: string | null;
  config: any | null;
  phase: string;
  createdAt: string;
  updatedAt: string;
};

function toInputValue(v: string | null) {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromInputValue(v: string) {
  if (!v.trim()) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function phaseLabel(p: string) {
  if (p === "DRAFT") return "未开始";
  if (p === "SUBMISSION") return "提交中";
  if (p === "JUDGING") return "评审中";
  if (p === "PUBLIC") return "公示中";
  if (p === "ENDED") return "已结束";
  return p;
}

export default function CompetitionsPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Competition[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const current = useMemo(() => items.find((c) => c.isCurrent) ?? null, [items]);

  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("绍兴市高校AI科普大赛");
  const [newTheme, setNewTheme] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [fSubmissionStart, setFSubmissionStart] = useState("");
  const [fSubmissionEnd, setFSubmissionEnd] = useState("");
  const [fJudgingStart, setFJudgingStart] = useState("");
  const [fJudgingEnd, setFJudgingEnd] = useState("");
  const [fPublicStart, setFPublicStart] = useState("");
  const [fPublicEnd, setFPublicEnd] = useState("");
  const [fConfig, setFConfig] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Competition[]>("/admin/competitions");
      setItems(data);
      setCurrentId(data.find((c) => c.isCurrent)?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function startEdit(c: Competition) {
    setEditingId(c.id);
    setFSubmissionStart(toInputValue(c.submissionStart));
    setFSubmissionEnd(toInputValue(c.submissionEnd));
    setFJudgingStart(toInputValue(c.judgingStart));
    setFJudgingEnd(toInputValue(c.judgingEnd));
    setFPublicStart(toInputValue(c.publicStart));
    setFPublicEnd(toInputValue(c.publicEnd));
    setFConfig(JSON.stringify(c.config ?? {}, null, 2));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      let config: any = undefined;
      try {
        config = fConfig.trim() ? JSON.parse(fConfig) : null;
      } catch {
        throw new Error("配置 JSON 解析失败");
      }
      await apiFetch(`/admin/competitions/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({
          submissionStart: fromInputValue(fSubmissionStart),
          submissionEnd: fromInputValue(fSubmissionEnd),
          judgingStart: fromInputValue(fJudgingStart),
          judgingEnd: fromInputValue(fJudgingEnd),
          publicStart: fromInputValue(fPublicStart),
          publicEnd: fromInputValue(fPublicEnd),
          config,
        }),
      });
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function setCurrent(id: string) {
    setError(null);
    try {
      await apiFetch(`/admin/competitions/${id}/set-current`, { method: "POST" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "设置失败");
    }
  }

  async function create() {
    setCreating(true);
    setError(null);
    try {
      await apiFetch("/admin/competitions", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle.trim(),
          theme: newTheme.trim() || undefined,
        }),
      });
      setNewTheme("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-zinc-900">赛事管理</h1>
          <Link className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm" href="/dashboard">
            返回
          </Link>
        </div>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-sm font-medium text-zinc-900">创建赛事</div>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="赛事标题"
            />
            <input
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
              value={newTheme}
              onChange={(e) => setNewTheme(e.target.value)}
              placeholder="主题（可选）"
            />
            <button
              className="rounded-md bg-zinc-900 text-white px-3 py-2 text-sm disabled:opacity-60"
              onClick={create}
              disabled={creating || !newTitle.trim()}
            >
              {creating ? "创建中..." : "创建"}
            </button>
          </div>
          {error ? <div className="mt-2 text-sm text-red-600 break-words">{error}</div> : null}
        </div>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-zinc-900">
              赛事列表 {current ? <span className="text-zinc-500 font-normal">（当前：{current.title}）</span> : null}
            </div>
            <button
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
              onClick={load}
              disabled={loading}
            >
              {loading ? "刷新中..." : "刷新"}
            </button>
          </div>

          <div className="mt-3 divide-y divide-zinc-200 text-sm">
            {items.map((c) => (
              <div key={c.id} className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-900 truncate">
                      {c.title}{" "}
                      {c.isCurrent ? (
                        <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                          当前
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-zinc-600">
                      阶段：{phaseLabel(c.phase)} · ID：{c.id}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!c.isCurrent ? (
                      <button
                        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                        onClick={() => setCurrent(c.id)}
                      >
                        设为当前
                      </button>
                    ) : null}
                    <button
                      className="rounded-md bg-zinc-900 text-white px-3 py-2 text-sm"
                      onClick={() => startEdit(c)}
                    >
                      编辑时间
                    </button>
                  </div>
                </div>

                {editingId === c.id ? (
                  <div className="mt-3 rounded-lg border border-zinc-200 p-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="space-y-1">
                        <div className="text-xs text-zinc-600">提交开始</div>
                        <input
                          type="datetime-local"
                          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                          value={fSubmissionStart}
                          onChange={(e) => setFSubmissionStart(e.target.value)}
                        />
                      </label>
                      <label className="space-y-1">
                        <div className="text-xs text-zinc-600">提交截止</div>
                        <input
                          type="datetime-local"
                          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                          value={fSubmissionEnd}
                          onChange={(e) => setFSubmissionEnd(e.target.value)}
                        />
                      </label>
                      <label className="space-y-1">
                        <div className="text-xs text-zinc-600">评审开始</div>
                        <input
                          type="datetime-local"
                          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                          value={fJudgingStart}
                          onChange={(e) => setFJudgingStart(e.target.value)}
                        />
                      </label>
                      <label className="space-y-1">
                        <div className="text-xs text-zinc-600">评审截止</div>
                        <input
                          type="datetime-local"
                          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                          value={fJudgingEnd}
                          onChange={(e) => setFJudgingEnd(e.target.value)}
                        />
                      </label>
                      <label className="space-y-1">
                        <div className="text-xs text-zinc-600">公示开始</div>
                        <input
                          type="datetime-local"
                          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                          value={fPublicStart}
                          onChange={(e) => setFPublicStart(e.target.value)}
                        />
                      </label>
                      <label className="space-y-1">
                        <div className="text-xs text-zinc-600">公示截止</div>
                        <input
                          type="datetime-local"
                          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                          value={fPublicEnd}
                          onChange={(e) => setFPublicEnd(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="mt-3">
                      <div className="text-xs text-zinc-600 mb-1">配置（JSON，可选）</div>
                      <textarea
                        className="w-full min-h-44 rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono"
                        value={fConfig}
                        onChange={(e) => setFConfig(e.target.value)}
                        placeholder='{"materialRequirements": {"VIDEO": {"requiredKinds":["VIDEO"], "rules":[{"kind":"VIDEO","maxBytes":524288000,"mimeTypes":["video/mp4"]},{"kind":"VIDEO","durationSecMin":60,"durationSecMax":300}]}}}'
                      />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        className="rounded-md bg-zinc-900 text-white px-3 py-2 text-sm disabled:opacity-60"
                        onClick={saveEdit}
                        disabled={saving}
                      >
                        {saving ? "保存中..." : "保存"}
                      </button>
                      <button className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm" onClick={cancelEdit}>
                        取消
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {items.length === 0 ? <div className="text-sm text-zinc-600">暂无赛事</div> : null}
          {currentId ? null : <div className="mt-2 text-xs text-zinc-500">提示：创建第一个赛事会自动设为当前。</div>}
        </div>
      </div>
    </div>
  );
}
