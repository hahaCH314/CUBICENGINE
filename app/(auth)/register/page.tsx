"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "", age: "" });
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, age: Number(form.age) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "エラーが発生しました"); return; }
      router.push(`/verify?email=${encodeURIComponent(form.email)}`);
    } catch {
      setError("ネットワークエラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground">アカウントを作成</h1>
        <p className="text-muted text-sm mt-1">MineModCraft Studio に参加しよう</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-2xl p-8 space-y-5">
        {/* Username */}
        <Field label="ユーザー名">
          <input
            type="text" value={form.username} onChange={update("username")}
            placeholder="craftmaster_123" required autoComplete="username"
            className={inputCls}
          />
          <Hint>3〜20文字、英数字とアンダースコアのみ</Hint>
        </Field>

        {/* Email */}
        <Field label="メールアドレス">
          <input
            type="email" value={form.email} onChange={update("email")}
            placeholder="you@example.com" required autoComplete="email"
            className={inputCls}
          />
        </Field>

        {/* Password */}
        <Field label="パスワード">
          <input
            type="password" value={form.password} onChange={update("password")}
            placeholder="8文字以上" required autoComplete="new-password"
            className={inputCls}
          />
        </Field>

        {/* Age */}
        <Field label="年齢">
          <input
            type="number" value={form.age} onChange={update("age")}
            placeholder="例: 16" required min={1} max={120}
            className={inputCls}
          />
          <Hint>年齢は他のユーザーには公開されません</Hint>
        </Field>

        {error && <ErrorBox>{error}</ErrorBox>}

        <button
          type="submit" disabled={loading}
          className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold transition-all hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {loading ? "送信中…" : "認証メールを送信"}
        </button>

        <p className="text-center text-sm text-muted">
          すでにアカウントをお持ちですか?{" "}
          <Link href="/login" className="text-accent hover:text-accent-hover transition-colors font-medium">
            ログイン
          </Link>
        </p>
      </form>
    </>
  );
}

/* ─── Small helpers ─── */

const inputCls =
  "w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted">{children}</p>;
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm px-4 py-3 rounded-lg">
      {children}
    </div>
  );
}
