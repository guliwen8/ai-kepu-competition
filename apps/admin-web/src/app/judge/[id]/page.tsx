'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import {
  labelCategory,
  labelReviewSummary,
  labelReviewTaskStatus,
  labelReviewTaskType,
} from '@/lib/labels';

type Task = { id: string; type: string; status: string; findings?: any };

export default function JudgeTaskDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [data, setData] = useState<any | null>(null);

  const [s1, setS1] = useState(0);
  const [s2, setS2] = useState(0);
  const [s3, setS3] = useState(0);
  const [s4, setS4] = useState(0);
  const [s5, setS5] = useState(0);
  const [comment, setComment] = useState('');

  const locked = useMemo(() => Boolean(data?.lockedAt), [data?.lockedAt]);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<any>(`/judge/judging/assignments/${id}`);
      setData(res);
      if (res?.score) {
        setS1(res.score.s1 ?? 0);
        setS2(res.score.s2 ?? 0);
        setS3(res.score.s3 ?? 0);
        setS4(res.score.s4 ?? 0);
        setS5(res.score.s5 ?? 0);
        setComment(res.score.comment ?? '');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function save() {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/judge/judging/assignments/${id}/score`, {
        method: 'PUT',
        body: JSON.stringify({ s1, s2, s3, s4, s5, comment }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    if (!id) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/judge/judging/assignments/${id}/submit`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  function back() {
    router.push('/judge');
  }

  const latestReview = data?.submission?.latestReview ?? null;
  const tasks: Task[] = latestReview?.tasks ?? [];

  function clampInt(v: string) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(10, Math.round(n)));
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-zinc-900">打分</h1>
          <button
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            onClick={back}
          >
            返回列表
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
          {error ? <div className="text-sm text-red-600 break-words">{error}</div> : null}
          {loading ? <div className="text-sm text-zinc-600">加载中...</div> : null}

          {data ? (
            <div className="space-y-4 text-sm">
              <div>
                <div className="text-zinc-900 font-medium">
                  {data.submission.blindCode ?? '-'} · {data.submission.title}
                </div>
                <div className="text-zinc-600">{labelCategory(data.submission.category)}</div>
              </div>

              {latestReview ? (
                <div className="rounded-lg border border-zinc-200 p-3">
                  <div className="text-zinc-900 font-medium">合规审查摘要</div>
                  <div className="mt-1 text-zinc-700">
                    结论：{labelReviewSummary(latestReview.summary)}
                  </div>
                  <div className="mt-2 space-y-1">
                    {tasks.map((t) => (
                      <div key={t.id} className="text-zinc-700">
                        {labelReviewTaskType(t.type)}：{labelReviewTaskStatus(t.status)}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <div className="text-zinc-700">科学准确性（s1）0-10</div>
                  <input
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                    value={s1}
                    onChange={(e) => setS1(clampInt(e.target.value))}
                    disabled={locked}
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-zinc-700">AI 技术深度（s2）0-10</div>
                  <input
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                    value={s2}
                    onChange={(e) => setS2(clampInt(e.target.value))}
                    disabled={locked}
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-zinc-700">传播效果（s3）0-10</div>
                  <input
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                    value={s3}
                    onChange={(e) => setS3(clampInt(e.target.value))}
                    disabled={locked}
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-zinc-700">创意（s4）0-10</div>
                  <input
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                    value={s4}
                    onChange={(e) => setS4(clampInt(e.target.value))}
                    disabled={locked}
                  />
                </label>
                <label className="space-y-1">
                  <div className="text-zinc-700">伦理（s5）0-10</div>
                  <input
                    className="w-full rounded-md border border-zinc-300 px-3 py-2"
                    value={s5}
                    onChange={(e) => setS5(clampInt(e.target.value))}
                    disabled={locked}
                  />
                </label>
              </div>

              <label className="space-y-1 block">
                <div className="text-zinc-700">评语（可选）</div>
                <textarea
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 min-h-28"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={locked}
                />
              </label>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                  onClick={save}
                  disabled={saving || locked}
                >
                  {saving ? '保存中...' : '保存草稿'}
                </button>
                <button
                  className="rounded-md bg-zinc-900 text-white px-3 py-2 text-sm disabled:opacity-60"
                  onClick={submit}
                  disabled={submitting || locked}
                >
                  {locked ? '已提交锁定' : submitting ? '提交中...' : '最终提交'}
                </button>
                {data?.score ? (
                  <div className="text-sm text-zinc-700 flex items-center">
                    当前总分：{data.score.total}
                  </div>
                ) : null}
              </div>

              {locked ? (
                <div className="text-xs text-zinc-500">已提交锁定：{data.lockedAt}</div>
              ) : (
                <div className="text-xs text-zinc-500">提示：最终提交后将锁定，不可再修改。</div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
