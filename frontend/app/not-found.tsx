import Link from "next/link";

/**
 * Root fallback for any request that bypasses the locale boundary.
 * Lives outside `app/[locale]/` because Next.js renders this when
 * notFound() is called from a route with no nearer not-found.tsx.
 */
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-4xl font-bold text-gray-900">404</h1>
          <p className="text-sm text-gray-500">
            The page you are looking for could not be found.
          </p>
          <Link
            href="/"
            className="text-sm font-medium text-blue-600 underline hover:text-blue-800"
          >
            Go back home
          </Link>
        </main>
      </body>
    </html>
  );
}
