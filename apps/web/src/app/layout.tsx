import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/inter';
import '@fontsource-variable/bricolage-grotesque';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { Providers } from '@/components/providers';
export const metadata: Metadata = {
  title: { default: 'VanTrack · Seu trajeto, conectado', template: '%s · VanTrack' },
  description:
    'Monitoramento e gestão de transporte de professores entre Rio de Janeiro e Teresópolis.',
  applicationName: 'VanTrack',
  appleWebApp: { capable: true, statusBarStyle: 'default' },
  manifest: '/manifest.webmanifest',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#2563EB' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#content">
          Pular para o conteúdo
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
