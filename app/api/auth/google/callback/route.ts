import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";

interface GoogleToken { access_token: string }
interface GoogleUser  { sub: string; email: string; name: string; picture?: string }

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const error = searchParams.get("error");

  const base     = process.env.NEXT_PUBLIC_BASE_URL ?? new URL(req.url).origin;
  const redirect = `${base}/api/auth/google/callback`;

  if (error || !code) {
    return NextResponse.redirect(`${base}/login?error=google_denied`);
  }

  const clientId     = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;

  // ① code → access_token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirect, grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return NextResponse.redirect(`${base}/login?error=google_token`);
  const token: GoogleToken = await tokenRes.json();

  // ② access_token → ユーザー情報
  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!userRes.ok) return NextResponse.redirect(`${base}/login?error=google_userinfo`);
  const gUser: GoogleUser = await userRes.json();

  // ③ DBで既存ユーザーを探す / 新規作成
  let user = db.getUserByGoogleId(gUser.sub);
  if (!user) {
    // 同じメールが既存なら Google ID を紐付け
    const existing = db.getUserByEmail(gUser.email);
    if (existing) {
      db.linkGoogleId(existing.id, gUser.sub, gUser.picture);
      user = db.getUserById(existing.id)!;
    } else {
      // 新規ユーザー（username は Google name から生成）
      const base_name = gUser.name.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase().slice(0, 16) || "user";
      let username = base_name;
      let suffix = 1;
      while (db.getUserByUsername(username)) { username = `${base_name}${suffix++}`; }
      user = db.createGoogleUser({ username, email: gUser.email, google_id: gUser.sub, avatar_url: gUser.picture });
    }
  }

  // ④ セッション作成 → エディターへリダイレクト
  await createSession({ sub: String(user.id), username: user.username, email: user.email });
  return NextResponse.redirect(`${base}/editor`);
}
