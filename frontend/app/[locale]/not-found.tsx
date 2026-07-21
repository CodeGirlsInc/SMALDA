import { Link } from "@/i18n/navigation";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="text-sm text-gray-500">
        The page you are looking for could not be found.
      </p>
      <Link
        href="/"
        className="text-sm font-medium text-blue-600 hover:text-blue-800"
      >
        Go back home
      </Link>
    </main>
  );
}
