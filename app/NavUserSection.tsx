"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

interface Props {
  user: { username: string } | null;
}

export function NavUserSection({ user }: Props) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  if (user) {
    return (
      <div className="hidden md:flex items-center gap-5 text-sm">
        <span className="text-muted">
          こんにちは、<span className="text-foreground font-medium">{user.username}</span>
        </span>
        <button
          onClick={logout}
          className="text-muted hover:text-foreground transition-colors"
        >
          ログアウト
        </button>
        <Link
          href="/editor"
          className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium transition-all hover:shadow-lg hover:shadow-accent/20"
        >
          エディターを開く
        </Link>
      </div>
    );
  }

  return (
    <div className="hidden md:flex items-center gap-3 text-sm">
      <a href="#features" className="text-muted hover:text-foreground transition-colors">
        機能
      </a>
      <a href="#about" className="text-muted hover:text-foreground transition-colors">
        概要
      </a>
      <Link href="/login" className="text-muted hover:text-foreground transition-colors">
        ログイン
      </Link>
      <Link
        href="/register"
        className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white font-medium transition-all hover:shadow-lg hover:shadow-accent/20"
      >
        新規登録
      </Link>
    </div>
  );
}
