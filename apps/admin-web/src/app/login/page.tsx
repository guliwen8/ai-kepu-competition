"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setTokens } from "@/lib/auth";

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "sms">("sms");
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("000000");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
      const endpoint = mode === "sms" ? "/auth/login/sms" : "/auth/login/password";
      const body =
        mode === "sms"
          ? { phone, code }
          : { identity, password };

      const res = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const tokens = (await res.json()) as LoginResponse;
      setTokens(tokens);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-zinc-200 p-6">
        <h1 className="text-xl font-semibold text-zinc-900">协会管理后台登录</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {mode === "sms" ? "手机号 + 验证码（开发环境：000000）" : "账号/邮箱/手机号 + 密码"}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className={
              mode === "sms"
                ? "rounded-md bg-zinc-900 text-white py-2 text-sm font-medium"
                : "rounded-md border border-zinc-300 bg-white text-zinc-900 py-2 text-sm"
            }
            type="button"
            onClick={() => setMode("sms")}
            disabled={loading}
          >
            短信验证码
          </button>
          <button
            className={
              mode === "password"
                ? "rounded-md bg-zinc-900 text-white py-2 text-sm font-medium"
                : "rounded-md border border-zinc-300 bg-white text-zinc-900 py-2 text-sm"
            }
            type="button"
            onClick={() => setMode("password")}
            disabled={loading}
          >
            密码登录
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {mode === "sms" ? (
            <>
              <div className="space-y-1">
                <label className="text-sm text-zinc-700">手机号</label>
                <input
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/20"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="例如：13957512889"
                  autoComplete="tel"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-zinc-700">验证码</label>
                <input
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/20"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="开发环境固定：000000"
                  inputMode="numeric"
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-sm text-zinc-700">账号</label>
                <input
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/20"
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  placeholder="username / email / phone"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-zinc-700">密码</label>
                <input
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-900/20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
            </>
          )}

          {error ? <div className="text-sm text-red-600 break-words">{error}</div> : null}

          <button
            className="w-full rounded-md bg-zinc-900 text-white py-2 text-sm font-medium disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
      </div>
    </div>
  );
}
