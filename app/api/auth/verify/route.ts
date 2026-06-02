import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "メールアドレスと認証コードを入力してください" },
        { status: 400 }
      );
    }

    const pending = db.getPending(email);

    if (!pending) {
      return NextResponse.json(
        { error: "認証情報が見つかりません。もう一度登録してください" },
        { status: 404 }
      );
    }

    if (new Date(pending.expires_at) < new Date()) {
      db.deletePending(email);
      return NextResponse.json(
        { error: "認証コードの有効期限が切れています。もう一度登録してください" },
        { status: 400 }
      );
    }

    if (pending.code !== String(code).trim()) {
      return NextResponse.json({ error: "認証コードが正しくありません" }, { status: 400 });
    }

    /* ── Create user & session ── */
    const user = db.createUser({
      username: pending.username,
      email: pending.email,
      password_hash: pending.password_hash,
      age: pending.age,
    });

    db.deletePending(email);

    await createSession({ sub: String(user.id), username: user.username, email: user.email });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[verify]", err);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
