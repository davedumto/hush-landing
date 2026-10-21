import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedRequest } from "@/lib/feedback/require-admin";
import { db } from "@/lib/feedback/db";
import { feedback } from "@/lib/feedback/schema";
import { and, desc, eq, ilike } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isAuthorizedRequest(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const conditions = [];
  if (type === "bug" || type === "feature") conditions.push(eq(feedback.type, type));
  if (status === "new" || status === "seen" || status === "done") conditions.push(eq(feedback.status, status));
  if (search) conditions.push(ilike(feedback.title, `%${search}%`));

  const database = db();
  const rows = await database
    .select()
    .from(feedback)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(feedback.createdAt))
    .limit(100);

  return NextResponse.json({ ok: true, data: rows });
}
