import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';
import { Loading } from '@/components/states';
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <AuthForm mode="register" />
    </Suspense>
  );
}
