import Link from "next/link";
import { and, desc, eq, ilike } from "drizzle-orm";
import { requireAdminPage } from "@/lib/feedback/require-admin-page";
import { db } from "@/lib/feedback/db";
import { feedback } from "@/lib/feedback/schema";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ type?: string; status?: string; search?: string }>;

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminPage();
  const { type, status, search } = await searchParams;

  const conditions = [];
  if (type === "bug" || type === "feature") conditions.push(eq(feedback.type, type));
  if (status === "new" || status === "seen" || status === "done") conditions.push(eq(feedback.status, status));
  if (search) conditions.push(ilike(feedback.title, `%${search}%`));

  const rows = await db()
    .select()
    .from(feedback)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(feedback.createdAt))
    .limit(100);

  const qs = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { type, status, search, ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v);
    }
    const str = params.toString();
    return str ? `?${str}` : "";
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">Feedback</h1>
          <form action="/api/admin/logout" method="POST">
            <button type="submit" className="text-sm text-neutral-500 hover:underline">
              Log out
            </button>
          </form>
        </div>

        <div className="flex flex-wrap gap-3 mb-6 text-sm">
          <Link href={qs({ type: undefined })} className={!type ? "font-semibold" : "text-neutral-500"}>
            All types
          </Link>
          <Link href={qs({ type: "bug" })} className={type === "bug" ? "font-semibold" : "text-neutral-500"}>
            Bugs
          </Link>
          <Link href={qs({ type: "feature" })} className={type === "feature" ? "font-semibold" : "text-neutral-500"}>
            Features
          </Link>
          <span className="text-neutral-300 dark:text-neutral-700">|</span>
          <Link href={qs({ status: undefined })} className={!status ? "font-semibold" : "text-neutral-500"}>
            All statuses
          </Link>
          <Link href={qs({ status: "new" })} className={status === "new" ? "font-semibold" : "text-neutral-500"}>
            New
          </Link>
          <Link href={qs({ status: "seen" })} className={status === "seen" ? "font-semibold" : "text-neutral-500"}>
            Seen
          </Link>
          <Link href={qs({ status: "done" })} className={status === "done" ? "font-semibold" : "text-neutral-500"}>
            Done
          </Link>
        </div>

        <form className="mb-6">
          {type && <input type="hidden" name="type" value={type} />}
          {status && <input type="hidden" name="status" value={status} />}
          <input
            type="text"
            name="search"
            defaultValue={search ?? ""}
            placeholder="Search by title"
            className="w-full max-w-sm rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm"
          />
        </form>

        <div className="border border-neutral-200 dark:border-neutral-800 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900 text-left">
              <tr>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">App version</th>
                <th className="px-3 py-2">Profile</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="px-3 py-2">{row.type}</td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/${row.id}`} className="hover:underline">
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-neutral-500">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-neutral-500">{row.appVersion ?? "—"}</td>
                  <td className="px-3 py-2 text-neutral-500">{row.profileName ?? "—"}</td>
                  <td className="px-3 py-2">{row.status}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-neutral-500">
                    No submissions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
