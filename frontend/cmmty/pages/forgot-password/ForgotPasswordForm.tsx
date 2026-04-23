import React, { useState } from 'react';

const ForgotPasswordForm = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      alert('Please enter a valid email.');
      return;
    }
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    } catch (err) {
      // swallow errors to avoid enumeration
    } finally {
      setSubmitted(true);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="forgot-form">
      <label>Email Address</label>
      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <button type="submit">Send Reset Link</button>
      {submitted && <p className="success-msg">If an account exists, a reset link has been sent.</p>}
    </form>
  );
};

export default ForgotPasswordForm;
