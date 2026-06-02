"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "エラーが発生しました"); return; }
      router.push("/");
      router.refresh();
    } catch {
      setError("ネットワークエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground">おかえりなさい</h1>
        <p className="text-muted text-sm mt-1">アカウントにログイン</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-2xl p-8 space-y-5">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">メールアドレス</label>
          <input
            type="email" value={form.email} onChange={update("email")}
            placeholder="you@example.com" required autoComplete="email"
            className={inputCls}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">パスワード</label>
          <input
            type="password" value={form.password} onChange={update("password")}
            placeholder="••••••••" required autoComplete="current-password"
            className={inputCls}
          />
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <button
          type="submit" disabled={loading}
          className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold transition-all hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {loading ? "ログイン中…" : "ログイン"}
        </button>

        <p className="text-center text-sm text-muted">
          アカウントをお持ちでない方は{" "}
          <Link href="/register" className="text-accent hover:text-accent-hover transition-colors font-medium">
            新規登録
          </Link>
        </p>
      </form>
    </>
  );
}

const inputCls =
  "w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors text-sm";
