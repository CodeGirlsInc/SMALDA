import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

/**
 * The form reads the `?redirect=` and `?reset=` params via `useSearchParams`,
 * which opts the subtree into client rendering — the Suspense boundary keeps
 * the rest of this route prerenderable instead of failing the static build.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Suspense fallback={<div className="h-96 w-full max-w-sm" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
