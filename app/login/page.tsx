import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-lot space-y-6 md:pt-6">
      <div>
        <h1 className="text-title-sm md:text-title">Verify your phone</h1>
        <p className="mt-1 text-body text-secondary">We&apos;ll text you a 6-digit code. Browsing is open to everyone; you only need this to bid or sell.</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
