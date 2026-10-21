import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/feedback/admin-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/admin/login", req.url), { status: 303 });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
