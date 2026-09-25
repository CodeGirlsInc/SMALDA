'use client';

import { Button } from '@/components/ui/button';

interface VerifyOnStellarButtonProps {
  loading?: boolean;
  disabled?: boolean;
  onVerify?: () => void;
}

export function VerifyOnStellarButton({ loading, disabled, onVerify }: VerifyOnStellarButtonProps) {
  return (
    <Button
      disabled={disabled || loading}
      onClick={onVerify}
      className="w-full sm:w-auto"
    >
      {loading && (
        <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      Verify on Stellar
    </Button>
  );
}