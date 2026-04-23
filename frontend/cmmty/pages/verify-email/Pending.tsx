import React, { useState } from 'react';

const Pending = () => {
  const [loading, setLoading] = useState(false);

  const handleResend = async () => {
    setLoading(true);
    try {
      await fetch('/api/auth/resend-verification', { method: 'POST' });
      alert('Verification email resent!');
    } catch {
      alert('Error resending email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="verify-container">
      <h1>Verify Your Email</h1>
      <p>Please check your inbox for a verification link.</p>
      <button onClick={handleResend} disabled={loading}>
        {loading ? 'Resending...' : 'Resend Email'}
      </button>
    </div>
  );
};

export default Pending;
