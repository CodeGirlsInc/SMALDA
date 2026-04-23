import React, { useState } from 'react';
import { useRouter } from 'next/router';

interface Props {
  token: string;
}

const ResetPasswordForm: React.FC<Props> = ({ token }) => {
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPass !== confirmPass) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPass }),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => router.push('/login'), 3000);
      } else {
        setError('Invalid or expired token.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="reset-form">
      <label>New Password</label>
      <input
        type="password"
        value={newPass}
        onChange={(e) => setNewPass(e.target.value)}
        required
      />
      <label>Confirm Password</label>
      <input
        type="password"
        value={confirmPass}
        onChange={(e) => setConfirmPass(e.target.value)}
        required
      />
      <button type="submit">Reset Password</button>
      {error && <p className="error-msg">{error}</p>}
      {success && <p className="success-msg">Password reset successful! Redirecting to login...</p>}
    </form>
  );
};

export default ResetPasswordForm;
