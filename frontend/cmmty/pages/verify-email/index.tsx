import React from 'react';
import { useRouter } from 'next/router';
import Pending from './Pending';
import Confirmed from './Confirmed';

const VerifyEmailPage = () => {
  const router = useRouter();
  const { token } = router.query;

  if (token) {
    return <Confirmed token={token as string} />;
  }
  return <Pending />;
};

export default VerifyEmailPage;
