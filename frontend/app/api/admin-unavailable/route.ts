export function GET() {
  return Response.json(
    { error: "Admin access is temporarily unavailable" },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
