import Link from "next/link";

interface NotFoundContentProps {
  description: string;
  homeLabel: string;
  homeHref?: string;
  detailDescription?: string;
}

export function NotFoundContent({
  description,
  homeLabel,
  homeHref = "/",
  detailDescription,
}: NotFoundContentProps) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-4xl font-bold text-gray-900">404</h1>
      <p className="text-sm text-gray-500">{description}</p>
      <Link
        href={homeHref}
        className="text-sm font-medium text-blue-600 underline hover:text-blue-800"
      >
        {homeLabel}
      </Link>
      {detailDescription ? (
        <p className="mt-6 max-w-md text-xs text-gray-400">{detailDescription}</p>
      ) : null}
    </main>
  );
}
