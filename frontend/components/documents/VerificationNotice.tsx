'use client';

interface VerificationNoticeProps {
  message: string;
}

export function VerificationNotice({ message }: VerificationNoticeProps) {
  return (
    <p className="text-sm text-muted-foreground">{message}</p>
  );
}