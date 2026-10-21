import { NextRequest, NextResponse } from "next/server";
import { checkPassword, signSessionToken, COOKIE_NAME } from "@/lib/feedback/admin-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");

  const expected = process.env.ADMIN_PASSWORD ?? "";
  const secret = process.env.COOKIE_SECRET ?? "";

  if (!checkPassword(password, expected) || !secret) {
    return NextResponse.redirect(new URL("/admin/login?error=1", req.url), { status: 303 });
  }

  const token = signSessionToken(secret);
  const res = NextResponse.redirect(new URL("/admin", req.url), { status: 303 });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
