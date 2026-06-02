import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "メールアドレスとパスワードを入力してください" },
        { status: 400 }
      );
    }

    const user = db.getUserByEmail(email);

    // Use constant-time comparison to prevent timing attacks
    const dummyHash = "$2b$12$invalidhashfortimingprotectiononly.......";
    const valid = (user && user.password_hash)
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, dummyHash).then(() => false);

    if (!user || !valid) {
      return NextResponse.json(
        { error: "メールアドレスまたはパスワードが正しくありません" },
        { status: 401 }
      );
    }

    await createSession({ sub: String(user.id), username: user.username, email: user.email });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}
