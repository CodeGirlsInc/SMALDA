import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

interface Props {
  token: string;
}

const Confirmed: React.FC<Props> = ({ token }) => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const router = useRouter();

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });
        if (res.ok) {
          setStatus('success');
          setTimeout(() => router.push('/dashboard'), 3000);
        } else {
          setStatus('error');
        }
      } catch {
        setStatus('error');
      }
    };
    verifyEmail();
  }, [token, router]);

  return (
    <div className="verify-container">
      {status === 'loading' && <p>Verifying your email...</p>}
      {status === 'success' && <p>Email verified! Redirecting to dashboard...</p>}
      {status === 'error' && <p>Verification failed. Please try again.</p>}
    </div>
  );
};

export default Confirmed;
