import { Suspense } from 'react';
import { ChatPage } from '@/components/chat-page';
import { Loading } from '@/components/states';
export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <ChatPage />
    </Suspense>
  );
}
