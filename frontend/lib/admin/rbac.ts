// This is intentionally simple.
// Replace this with your real auth logic (NextAuth / Clerk / custom session)
export type SessionUser = {
  id: string;
  email: string;
  role: "admin" | "user";
};

export function isAdmin(user: SessionUser | null | undefined) {
  return user?.role === "admin";
}
