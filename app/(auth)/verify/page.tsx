"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

/* ─── Inner component (uses useSearchParams) ─── */

function VerifyForm() {
  const router = useRouter();
  const email = useSearchParams().get("email") ?? "";

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resentMsg, setResentMsg] = useState("");
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function handleChange(i: number, val: string) {
    const d = val.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 5) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...digits];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = digits.join("");
    if (code.length < 6) { setError("6桁の認証コードを入力してください"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
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

  async function handleResend() {
    setResending(true);
    setResentMsg("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resendOnly: true, email }),
      });
      setResentMsg(res.ok ? "コードを再送しました" : "再送に失敗しました");
    } catch {
      setResentMsg("ネットワークエラーが発生しました");
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <div className="text-center mb-8">
        {/* Mail icon */}
        <div className="w-16 h-16 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground">メールを確認してください</h1>
        <p className="text-muted text-sm mt-2 leading-relaxed">
          <span className="text-foreground font-medium">{email}</span> に<br />
          6桁の認証コードを送信しました
        </p>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-8">
        <form onSubmit={handleSubmit}>
          {/* 6-digit input */}
          <div className="flex gap-2.5 justify-center mb-6" onPaste={handlePaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { refs.current[i] = el; }}
                type="text" inputMode="numeric" maxLength={1} value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={(e) => e.target.select()}
                className="w-11 h-14 text-center text-xl font-bold bg-background border-2 border-border rounded-xl text-foreground focus:outline-none focus:border-accent transition-colors"
              />
            ))}
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || digits.join("").length < 6}
            className="w-full py-3 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "認証中…" : "認証する →"}
          </button>
        </form>

        <div className="mt-5 pt-5 border-t border-border text-center text-sm text-muted space-y-1">
          <p>
            コードが届かない場合{" "}
            <button
              onClick={handleResend} disabled={resending}
              className="text-accent hover:text-accent-hover transition-colors font-medium disabled:opacity-60"
            >
              {resending ? "送信中…" : "再送する"}
            </button>
          </p>
          {resentMsg && <p className="text-xs">{resentMsg}</p>}
          <p>
            メールアドレスを変更する場合は{" "}
            <Link href="/register" className="text-accent hover:text-accent-hover transition-colors">
              最初からやり直す
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}

/* ─── Page wrapper with Suspense (required for useSearchParams) ─── */

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="text-center text-muted py-12">読み込み中…</div>}>
      <VerifyForm />
    </Suspense>
  );
}
