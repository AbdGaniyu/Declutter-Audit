import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="text-title">Sign in with your phone</h1>
      <p className="mt-1 text-small text-muted">We'll text you a 6-digit code. Only verified numbers can bid or sell.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
