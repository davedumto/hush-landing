import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAdminPage } from "@/lib/feedback/require-admin-page";
import { db } from "@/lib/feedback/db";
import { feedback } from "@/lib/feedback/schema";
import { setFeedbackStatus } from "../actions";

export const dynamic = "force-dynamic";

export default async function AdminDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;

  const rows = await db().select().from(feedback).where(eq(feedback.id, id)).limit(1);
  const row = rows[0];
  if (!row) notFound();

  const fields = row.fields as Record<string, string | undefined>;

  async function markSeen() {
    "use server";
    await setFeedbackStatus(id, "seen");
  }
  async function markDone() {
    "use server";
    await setFeedbackStatus(id, "done");
  }

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 p-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/admin" className="text-sm text-neutral-500 hover:underline">
          ← Back
        </Link>

        <div className="mt-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{row.title}</h1>
          <span className="text-sm rounded-full px-3 py-1 bg-neutral-100 dark:bg-neutral-800">{row.status}</span>
        </div>
        <p className="text-sm text-neutral-500 mt-1">
          {row.type} · {new Date(row.createdAt).toLocaleString()}
        </p>

        <div className="flex gap-2 mt-4">
          <form action={markSeen}>
            <button className="text-sm rounded border border-neutral-300 dark:border-neutral-700 px-3 py-1.5">
              Mark seen
            </button>
          </form>
          <form action={markDone}>
            <button className="text-sm rounded border border-neutral-300 dark:border-neutral-700 px-3 py-1.5">
              Mark done
            </button>
          </form>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-neutral-500">App version</dt>
            <dd>
              {row.appVersion ?? "—"} ({row.appBuild ?? "—"})
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Mac</dt>
            <dd>
              {row.macModel ?? "—"} — macOS {row.macosVersion ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Profile</dt>
            <dd>{row.profileName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Model</dt>
            <dd>{row.model ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Locale</dt>
            <dd>{row.locale ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Reply email</dt>
            <dd>{row.replyEmail ?? "—"}</dd>
          </div>
        </dl>

        <div className="mt-6 space-y-4">
          {fields.whatHappened && (
            <section>
              <h2 className="text-sm font-semibold text-neutral-500 mb-1">What happened</h2>
              <p className="whitespace-pre-wrap text-sm">{fields.whatHappened}</p>
            </section>
          )}
          {fields.steps && (
            <section>
              <h2 className="text-sm font-semibold text-neutral-500 mb-1">Steps</h2>
              <p className="whitespace-pre-wrap text-sm">{fields.steps}</p>
            </section>
          )}
          {fields.expected && (
            <section>
              <h2 className="text-sm font-semibold text-neutral-500 mb-1">Expected</h2>
              <p className="whitespace-pre-wrap text-sm">{fields.expected}</p>
            </section>
          )}
          {fields.featureDescription && (
            <section>
              <h2 className="text-sm font-semibold text-neutral-500 mb-1">Feature description</h2>
              <p className="whitespace-pre-wrap text-sm">{fields.featureDescription}</p>
            </section>
          )}
          {row.diagnostics && (
            <section>
              <h2 className="text-sm font-semibold text-neutral-500 mb-1">Diagnostics</h2>
              <pre className="whitespace-pre-wrap text-xs bg-neutral-50 dark:bg-neutral-900 p-3 rounded overflow-auto">
                {row.diagnostics}
              </pre>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
