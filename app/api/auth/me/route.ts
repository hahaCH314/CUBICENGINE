import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null }, { status: 401 });

  const user = db.getUserById(Number(session.sub));
  return NextResponse.json({
    user: {
      id: session.sub,
      username: session.username,
      email: session.email,
      avatar_url: user?.avatar_url ?? null,
    },
  });
}
