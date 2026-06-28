'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  const router = useRouter();

  useEffect(() => {
    if (!token) {
      router.replace('/login');
    }
  }, [token, router]);

  if (!token) return null;

  return <>{children}</>;
}
