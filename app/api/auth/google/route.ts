import { NextResponse } from "next/server";

export function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google OAuth が設定されていません" }, { status: 500 });
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? new URL(req.url).origin;
  const redirect = `${base}/api/auth/google/callback`;

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");

  return NextResponse.redirect(url.toString());
}
