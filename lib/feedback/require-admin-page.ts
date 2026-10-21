import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySessionToken, COOKIE_NAME } from "./admin-auth";

export async function requireAdminPage() {
  const secret = process.env.COOKIE_SECRET ?? "";
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!secret || !verifySessionToken(token, secret)) {
    redirect("/admin/login");
  }
}
