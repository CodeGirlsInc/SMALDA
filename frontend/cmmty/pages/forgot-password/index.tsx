import React from 'react';
import ForgotPasswordForm from './ForgotPasswordForm';

const ForgotPasswordPage = () => {
  return (
    <div className="forgot-container">
      <h1>Forgot Password</h1>
      <ForgotPasswordForm />
      <a href="/login" className="back-link">Back to Login</a>
    </div>
  );
};

export default ForgotPasswordPage;
