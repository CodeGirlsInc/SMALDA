import { Suspense } from "react";
import SessionRefreshClient from "./SessionRefreshClient";

export default function SessionRefreshPage() {
  return (
    <Suspense fallback={<div className="h-32 w-full max-w-md" />}>
      <SessionRefreshClient />
    </Suspense>
  );
}
