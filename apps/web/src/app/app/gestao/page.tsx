import { Suspense } from 'react';
import { ManagementPage } from '@/components/management-page';
import { Loading } from '@/components/states';
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <ManagementPage />
    </Suspense>
  );
}
