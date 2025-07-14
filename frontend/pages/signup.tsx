import { useForm } from 'react-hook-form';
import { useState } from 'react';
import '../app/styles/auth.css';


type FormData = { email: string; password: string };

export default function Signup() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();
  const [showPass, setShowPass] = useState(false);
  const [message, setMessage] = useState('');

  const onSubmit = async (data: FormData) => {
    const res = await fetch('http://localhost:3000/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    setMessage(result.message);
  };

  return (
    <div className="auth-container">
      <form onSubmit={handleSubmit(onSubmit)}>
        <h2>Sign Up</h2>

        <input placeholder="Email" {...register('email', { required: true, pattern: /^\S+@\S+$/i })} />
        {errors.email && <p>Email is required & must be valid</p>}

        <div className="input-wrapper">
          <input
            placeholder="Password"
            type={showPass ? 'text' : 'password'}
            {...register('password', { required: true })}
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPass(!showPass)}
            tabIndex={-1}
          >
            {showPass ? '👁️' : '👁️‍🗨️'}
          </button>
        </div>
        {errors.password && <p>Password is required</p>}

        <button type="submit">Signup</button>
        {message && <p>{message}</p>}
      </form>
    </div>
  );
}
