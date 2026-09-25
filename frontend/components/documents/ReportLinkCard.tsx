'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface ReportLinkCardProps {
  href: string;
}

export function ReportLinkCard({ href }: ReportLinkCardProps) {
  return (
    <Link href={href}>
      <Button variant="outline" className="w-full sm:w-auto">
        Download Report
      </Button>
    </Link>
  );
}