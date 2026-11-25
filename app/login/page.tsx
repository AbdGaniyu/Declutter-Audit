import { Suspense } from 'react';
import { Card } from '@/components/Field';
import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-lot space-y-4">
      <div>
        <h1 className="font-display text-display">Verify your phone</h1>
        <p className="mt-1 text-body text-ink-muted">We&apos;ll text you a 6-digit code. Browsing is open to everyone; you only need this to bid or sell.</p>
      </div>
      <Card>
        <Suspense>
          <LoginForm />
        </Suspense>
      </Card>
    </div>
  );
}
