import React from 'react';
import { useRouter } from 'next/router';
import ResetPasswordForm from './ResetPasswordForm';

const ResetPasswordPage = () => {
  const router = useRouter();
  const { token } = router.query;

  return (
    <div className="reset-container">
      <h1>Reset Password</h1>
      {token ? (
        <ResetPasswordForm token={token as string} />
      ) : (
        <p>Invalid or missing reset token.</p>
      )}
    </div>
  );
};

export default ResetPasswordPage;
