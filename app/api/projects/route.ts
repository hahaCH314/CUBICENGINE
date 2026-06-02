import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

/* GET /api/projects → ログインユーザーのプロジェクト一覧 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未ログイン" }, { status: 401 });

  const projects = db.getUserProjects(Number(session.sub));
  return NextResponse.json({ projects });
}

/* POST /api/projects → 保存・上書き */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未ログイン" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.name || !body?.data) {
    return NextResponse.json({ error: "name と data は必須です" }, { status: 400 });
  }

  const project = db.upsertProject(
    Number(session.sub),
    String(body.name).slice(0, 64),
    typeof body.data === "string" ? body.data : JSON.stringify(body.data),
    String(body.platform ?? "bedrock"),
    String(body.mc_version ?? "1.26.x"),
    body.id ? Number(body.id) : undefined,
  );

  return NextResponse.json({ project });
}

/* DELETE /api/projects?id=xxx */
export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "未ログイン" }, { status: 401 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id が必要です" }, { status: 400 });

  db.deleteProject(Number(id), Number(session.sub));
  return NextResponse.json({ ok: true });
}
