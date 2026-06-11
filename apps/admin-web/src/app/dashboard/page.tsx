"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { clearTokens } from "@/lib/auth";
import Link from "next/link";
import { labelRole, labelUserStatus } from "@/lib/labels";

type MeResponse = {
  id: string;
  phone: string | null;
  email: string | null;
  username: string | null;
  status: string;
  createdAt: string;
  roles: string[];
};

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [bootstrapMsg, setBootstrapMsg] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiFetch<MeResponse>("/auth/me")
      .then((data) => {
        if (mounted) setMe(data);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "加载失败");
      });
    return () => {
      mounted = false;
    };
  }, []);

  function logout() {
    clearTokens();
    router.push("/login");
  }

  async function bootstrapAdmin() {
    setBootstrapMsg(null);
    setBootstrapping(true);
    try {
      await apiFetch("/admin/bootstrap", {
        method: "POST",
        body: JSON.stringify({ token: bootstrapToken }),
      });
      setBootstrapMsg("已授予 admin 角色，请重新登录获取新 Token。");
    } catch (e) {
      setBootstrapMsg(e instanceof Error ? e.message : "授予失败");
    } finally {
      setBootstrapping(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-zinc-900">管理后台</h1>
          <button
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
            onClick={logout}
          >
            退出登录
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
          {error ? <div className="text-sm text-red-600 break-words">{error}</div> : null}
          {!error && !me ? <div className="text-sm text-zinc-600">加载中...</div> : null}
          {me ? (
            <div className="space-y-2 text-sm">
              <div className="text-zinc-900 font-medium">当前用户</div>
              <div className="grid grid-cols-1 gap-1 text-zinc-700">
                <div>ID：{me.id}</div>
                <div>用户名：{me.username ?? "-"}</div>
                <div>手机号：{me.phone ?? "-"}</div>
                <div>状态：{labelUserStatus(me.status)}</div>
                <div>角色：{me.roles.map(labelRole).join(" / ") || "-"}</div>
              </div>
              <div className="pt-2 flex flex-wrap gap-2">
                <Link
                  className="rounded-md bg-zinc-900 text-white px-3 py-2 text-sm"
                  href="/reviews"
                >
                  打开复核台
                </Link>
                {me.roles.includes("admin") ? (
                  <Link
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                    href="/judging"
                  >
                    评审管理
                  </Link>
                ) : null}
                {me.roles.includes("admin") ? (
                  <Link
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                    href="/competitions"
                  >
                    赛事管理
                  </Link>
                ) : null}
                {me.roles.includes("admin") ? (
                  <Link
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                    href="/ranking"
                  >
                    公示榜单
                  </Link>
                ) : null}
                {me.roles.includes("admin") ? (
                  <Link
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                    href="/audit"
                  >
                    审计日志
                  </Link>
                ) : null}
                {me.roles.includes("judge") ? (
                  <Link
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                    href="/judge"
                  >
                    评委任务
                  </Link>
                ) : null}
              </div>

              {!me.roles.includes("admin") ? (
                <div className="pt-4 border-t border-zinc-200 space-y-2">
                  <div className="text-zinc-900 font-medium">管理员授权（开发环境）</div>
                  <div className="text-xs text-zinc-500">
                    需要在根目录 .env 配置 ADMIN_BOOTSTRAP_TOKEN，输入后点击授权；成功后请重新登录
                  </div>
                  <div className="flex flex-col md:flex-row gap-2">
                    <input
                      className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/20"
                      value={bootstrapToken}
                      onChange={(e) => setBootstrapToken(e.target.value)}
                      placeholder="ADMIN_BOOTSTRAP_TOKEN"
                    />
                    <button
                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
                      onClick={bootstrapAdmin}
                      disabled={!bootstrapToken || bootstrapping}
                    >
                      {bootstrapping ? "授权中..." : "授予 admin"}
                    </button>
                  </div>
                  {bootstrapMsg ? <div className="text-sm text-zinc-700 break-words">{bootstrapMsg}</div> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
