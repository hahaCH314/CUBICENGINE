import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { sendVerificationCode } from "@/lib/email";

function generateCode(): string {
  if (!process.env.SMTP_HOST) {
    return "123456";
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
  try {
    const { username, email, password, age } = await req.json();

    /* ── Validation ── */
    if (!username || !email || !password || age === undefined) {
      return NextResponse.json({ error: "すべての項目を入力してください" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json(
        { error: "ユーザー名は3〜20文字の英数字・アンダースコアで入力してください" },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "有効なメールアドレスを入力してください" }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "パスワードは8文字以上で入力してください" }, { status: 400 });
    }
    const ageNum = Number(age);
    if (!Number.isInteger(ageNum) || ageNum < 1 || ageNum > 120) {
      return NextResponse.json({ error: "有効な年齢を入力してください" }, { status: 400 });
    }

    /* ── Duplicate check ── */
    if (db.getUserByEmail(email)) {
      return NextResponse.json(
        { error: "このメールアドレスは既に登録されています" },
        { status: 409 }
      );
    }
    if (db.getUserByUsername(username)) {
      return NextResponse.json(
        { error: "このユーザー名は既に使用されています" },
        { status: 409 }
      );
    }

    /* ── Store pending & send code ── */
    const passwordHash = await bcrypt.hash(password, 12);
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    db.upsertPending({ username, email, password_hash: passwordHash, age: ageNum, code, expires_at: expiresAt });
    db.cleanupExpired();

    await sendVerificationCode(email, code);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
