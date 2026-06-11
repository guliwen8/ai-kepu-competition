"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { labelCategory, labelJudgingAssignmentStatus, labelSubmissionStatus } from "@/lib/labels";

type MeResponse = { roles: string[] };

type ListItem = {
  id: string;
  title: string;
  category: string;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  judgingAssignedCount: number;
  judgingSubmittedCount: number;
  latestReview: null | { summary: string };
};

type SubmissionsList = { total: number; page: number; pageSize: number; items: ListItem[] };

type JudgesList = {
  total: number;
  page: number;
  pageSize: number;
  items: Array<{
    id: string;
    phone: string | null;
    username: string | null;
    judgeProfile: any | null;
    assignedCount: number;
    submittedCount: number;
    completionRate: number;
  }>;
};

type AssignmentsList = {
  page: number;
  pageSize: number;
  total: number;
  items: Array<{
    id: string;
    status: string;
    createdAt: string;
    submittedAt: string | null;
    lockedAt: string | null;
    submission: { id: string; category: string; title: string; blindCode: string | null; status: string };
    judge: { id: string; phone: string | null; username: string | null; judgeProfile: any | null };
    score: any | null;
  }>;
};

export default function JudgingAdminPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [grantPhone, setGrantPhone] = useState("");
  const [grantName, setGrantName] = useState("");
  const [grantOrg, setGrantOrg] = useState("");
  const [grantMsg, setGrantMsg] = useState<string | null>(null);
  const [granting, setGranting] = useState(false);

  const [submissionsQ, setSubmissionsQ] = useState("");
  const [submissionsStatus, setSubmissionsStatus] = useState("APPROVED");
  const [submissions, setSubmissions] = useState<SubmissionsList | null>(null);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<Record<string, boolean>>({});

  const [judgesQ, setJudgesQ] = useState("");
  const [judges, setJudges] = useState<JudgesList | null>(null);
  const [loadingJudges, setLoadingJudges] = useState(false);
  const [selectedJudgeIds, setSelectedJudgeIds] = useState<Record<string, boolean>>({});

  const [assignMsg, setAssignMsg] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const [list, setList] = useState<AssignmentsList | null>(null);
  const [loadingList, setLoadingList] = useState(false);

  const canAdmin = useMemo(() => Boolean(me?.roles?.includes("admin")), [me?.roles]);

  useEffect(() => {
    apiFetch<{ roles: string[] }>("/auth/me")
      .then((data) => setMe({ roles: data.roles }))
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  async function loadList() {
    setLoadingList(true);
    try {
      const data = await apiFetch<AssignmentsList>("/admin/judging/assignments?page=1&pageSize=50");
      setList(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    if (canAdmin) void loadList();
  }, [canAdmin]);

  async function loadSubmissions() {
    setLoadingSubmissions(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      sp.set("page", "1");
      sp.set("pageSize", "20");
      if (submissionsQ.trim()) sp.set("q", submissionsQ.trim());
      if (submissionsStatus) sp.set("status", submissionsStatus);
      const data = await apiFetch<SubmissionsList>(`/admin/submissions?${sp.toString()}`);
      setSubmissions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoadingSubmissions(false);
    }
  }

  async function loadJudges() {
    setLoadingJudges(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      sp.set("page", "1");
      sp.set("pageSize", "50");
      if (judgesQ.trim()) sp.set("q", judgesQ.trim());
      const data = await apiFetch<JudgesList>(`/admin/judging/judges?${sp.toString()}`);
      setJudges(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoadingJudges(false);
    }
  }

  useEffect(() => {
    if (!canAdmin) return;
    void loadSubmissions();
  }, [canAdmin, submissionsQ, submissionsStatus]);

  useEffect(() => {
    if (!canAdmin) return;
    void loadJudges();
  }, [canAdmin, judgesQ]);

  async function grantJudge() {
    setGrantMsg(null);
    setGranting(true);
    try {
      const res = await apiFetch<{ ok: boolean; userId: string }>("/admin/judging/judges/grant", {
        method: "POST",
        body: JSON.stringify({
          phone: grantPhone.trim(),
          realName: grantName.trim(),
          orgName: grantOrg.trim() || undefined,
        }),
      });
      setSelectedJudgeIds((prev) => ({ ...prev, [res.userId]: true }));
      await loadJudges();
      setGrantMsg(`已授予评委角色（userId：${res.userId}）。评委需要重新登录获取新 Token。`);
    } catch (e) {
      setGrantMsg(e instanceof Error ? e.message : "授予失败");
    } finally {
      setGranting(false);
    }
  }

  async function assignBatch() {
    setAssignMsg(null);
    setAssigning(true);
    try {
      const subIds = Object.entries(selectedSubmissionIds)
        .filter(([, v]) => v)
        .map(([k]) => k);
      const jIds = Object.entries(selectedJudgeIds)
        .filter(([, v]) => v)
        .map(([k]) => k);

      const res = await apiFetch<{ createdCount: number; skipped: any[] }>("/admin/judging/assignments:batch", {
        method: "POST",
        body: JSON.stringify({
          submissionIds: subIds,
          judgeIds: jIds,
          ensureBlindCode: true,
          mode: "cross",
        }),
      });
      setAssignMsg(`已创建 ${res.createdCount} 条分配；跳过 ${res.skipped.length} 条`);
      await loadList();
    } catch (e) {
      setAssignMsg(e instanceof Error ? e.message : "分配失败");
    } finally {
      setAssigning(false);
    }
  }

  function goLogin() {
    router.push("/login");
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-50 p-6">
        <div className="max-w-4xl mx-auto rounded-xl border border-zinc-200 bg-white p-4">
          <div className="text-sm text-red-600 break-words">{error}</div>
          <button className="mt-3 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm" onClick={goLogin}>
            去登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-zinc-900">评审管理（MVP）</h1>
          <Link className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm" href="/dashboard">
            返回
          </Link>
        </div>

        {!canAdmin ? (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
            需要 admin 角色
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-medium text-zinc-900">评委授权</div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={grantPhone}
                  onChange={(e) => setGrantPhone(e.target.value)}
                  placeholder="评委手机号（需已登录注册）"
                />
                <input
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={grantName}
                  onChange={(e) => setGrantName(e.target.value)}
                  placeholder="评委姓名"
                />
                <input
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm"
                  value={grantOrg}
                  onChange={(e) => setGrantOrg(e.target.value)}
                  placeholder="单位（可选）"
                />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  className="rounded-md bg-zinc-900 text-white px-3 py-2 text-sm disabled:opacity-60"
                  onClick={grantJudge}
                  disabled={granting || !grantPhone.trim() || !grantName.trim()}
                >
                  {granting ? "处理中..." : "授予评委"}
                </button>
                {grantMsg ? <div className="text-sm text-zinc-700 break-words">{grantMsg}</div> : null}
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
              <div className="text-sm font-medium text-zinc-900">批量分配（交叉分配）</div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-zinc-200 p-3">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-zinc-900">选择作品</div>
                    <input
                      className="ml-auto w-40 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                      placeholder="搜索标题/ID"
                      value={submissionsQ}
                      onChange={(e) => setSubmissionsQ(e.target.value)}
                    />
                    <select
                      className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm"
                      value={submissionsStatus}
                      onChange={(e) => setSubmissionsStatus(e.target.value)}
                    >
                      <option value="APPROVED">已通过</option>
                      <option value="IN_JUDGING">评审中</option>
                      <option value="UNDER_REVIEW">审核中</option>
                      <option value="">全部</option>
                    </select>
                  </div>
                  {loadingSubmissions ? <div className="mt-2 text-sm text-zinc-600">加载中...</div> : null}
                  {submissions ? (
                    <div className="mt-2 max-h-72 overflow-auto divide-y divide-zinc-100">
                      {submissions.items.map((s) => (
                        <label key={s.id} className="flex items-start gap-2 py-2 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={Boolean(selectedSubmissionIds[s.id])}
                            onChange={(e) =>
                              setSelectedSubmissionIds((prev) => ({ ...prev, [s.id]: e.target.checked }))
                            }
                          />
                          <div className="min-w-0">
                            <div className="text-zinc-900 font-medium truncate">{s.title}</div>
                            <div className="text-xs text-zinc-600">
                              {labelCategory(s.category)} · {labelSubmissionStatus(s.status)} · {s.id}
                            </div>
                            <div className="text-xs text-zinc-500">
                              已分配 {s.judgingAssignedCount} · 已提交 {s.judgingSubmittedCount}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-lg border border-zinc-200 p-3">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-zinc-900">选择评委</div>
                    <input
                      className="ml-auto w-40 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                      placeholder="姓名/手机号"
                      value={judgesQ}
                      onChange={(e) => setJudgesQ(e.target.value)}
                    />
                  </div>
                  {loadingJudges ? <div className="mt-2 text-sm text-zinc-600">加载中...</div> : null}
                  {judges ? (
                    <div className="mt-2 max-h-72 overflow-auto divide-y divide-zinc-100">
                      {judges.items.map((u) => (
                        <label key={u.id} className="flex items-start gap-2 py-2 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={Boolean(selectedJudgeIds[u.id])}
                            onChange={(e) => setSelectedJudgeIds((prev) => ({ ...prev, [u.id]: e.target.checked }))}
                          />
                          <div className="min-w-0">
                            <div className="text-zinc-900 font-medium truncate">
                              {u.judgeProfile?.realName ?? u.phone ?? u.username ?? u.id}
                            </div>
                            <div className="text-xs text-zinc-600">
                              {u.judgeProfile?.orgName ?? "-"} · {u.phone ?? "-"} · {u.id}
                            </div>
                            <div className="text-xs text-zinc-500">
                              已提交 {u.submittedCount}/{u.assignedCount} · 完成率 {u.completionRate}%
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  className="rounded-md bg-zinc-900 text-white px-3 py-2 text-sm disabled:opacity-60"
                  onClick={assignBatch}
                  disabled={
                    assigning ||
                    Object.values(selectedSubmissionIds).every((v) => !v) ||
                    Object.values(selectedJudgeIds).every((v) => !v)
                  }
                >
                  {assigning ? "分配中..." : "开始分配"}
                </button>
                <a
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                  href={`${apiBase}/admin/judging/export?submittedOnly=0`}
                  target="_blank"
                  rel="noreferrer"
                >
                  导出 CSV
                </a>
                {assignMsg ? <div className="text-sm text-zinc-700 break-words">{assignMsg}</div> : null}
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-zinc-900">分配列表</div>
                <button
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                  onClick={loadList}
                  disabled={loadingList}
                >
                  {loadingList ? "刷新中..." : "刷新"}
                </button>
              </div>

              {!list ? <div className="mt-3 text-sm text-zinc-600">加载中...</div> : null}
              {list ? (
                <div className="mt-3 divide-y divide-zinc-200 text-sm">
                  {list.items.map((it) => (
                    <div key={it.id} className="py-3 flex flex-col gap-1">
                      <div className="text-zinc-900 font-medium">
                        {it.submission.blindCode ?? "-"} · {it.submission.title}
                      </div>
                      <div className="text-zinc-700">
                        assignmentId：{it.id} · 状态：{labelJudgingAssignmentStatus(it.status)} · 评委：
                        {it.judge.judgeProfile?.realName ?? it.judge.phone ?? it.judge.id}
                      </div>
                      <div className="text-zinc-700">
                        submissionId：{it.submission.id} · total：{it.score?.total ?? "-"} · submittedAt：
                        {it.submittedAt ?? "-"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
