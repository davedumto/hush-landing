import { NextRequest } from "next/server";
import { verifySessionToken, checkBearerToken, COOKIE_NAME } from "./admin-auth";

export function isAuthorizedRequest(req: NextRequest): boolean {
  const secret = process.env.COOKIE_SECRET ?? "";
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (secret && verifySessionToken(token, secret)) return true;

  const adminToken = process.env.ADMIN_TOKEN ?? "";
  const authHeader = req.headers.get("authorization");
  if (adminToken && checkBearerToken(authHeader, adminToken)) return true;

  return false;
}
