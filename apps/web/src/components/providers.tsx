'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react';
import { ThemeProvider } from 'next-themes';
import { useEffect, useState } from 'react';
export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 10000, retry: 1, refetchOnWindowFocus: true } },
      }),
  );
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  useEffect(() => {
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={client}>
        {!online && (
          <div className="offline-banner" role="status">
            <WifiOff size={17} />
            Você está offline. Os dados podem estar desatualizados.
          </div>
        )}
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
