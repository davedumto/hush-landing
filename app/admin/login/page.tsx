export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-neutral-950 px-4">
      <form
        action="/api/admin/login"
        method="POST"
        className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 dark:border-neutral-800 p-6"
      >
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Admin login</h1>
        {error && <p className="text-sm text-red-600 dark:text-red-400">Incorrect password.</p>}
        <div>
          <label htmlFor="password" className="block text-sm text-neutral-700 dark:text-neutral-300 mb-1">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoFocus
            className="w-full rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 py-2 text-sm font-medium"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
