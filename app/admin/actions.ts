"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireAdminPage } from "@/lib/feedback/require-admin-page";
import { db } from "@/lib/feedback/db";
import { feedback } from "@/lib/feedback/schema";

export async function setFeedbackStatus(id: string, status: "new" | "seen" | "done") {
  await requireAdminPage();
  if (status !== "new" && status !== "seen" && status !== "done") {
    throw new Error("Invalid status");
  }
  await db().update(feedback).set({ status }).where(eq(feedback.id, id));
  revalidatePath("/admin");
  revalidatePath(`/admin/${id}`);
}
