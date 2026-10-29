'use client';
import { AlertCircle, MapPin, LoaderCircle } from 'lucide-react';
import { Button } from './ui/button';
export function Loading() {
  return (
    <div className="skeleton-layout" role="status" aria-label="Carregando">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton map-skeleton" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
export function ErrorState({ error, retry }: { error: Error | null; retry?: () => void }) {
  return (
    <div className="empty-state" role="alert">
      <AlertCircle size={30} />
      <h2>Não conseguimos carregar</h2>
      <p>{error?.message ?? 'Tente novamente em instantes.'}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
export function Empty({
  title = 'Nenhuma viagem por aqui',
  description = 'As próximas viagens aparecerão aqui quando forem programadas.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="empty-state">
      <MapPin size={30} />
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
export function Feedback({ message, pending = false }: { message: string; pending?: boolean }) {
  return message ? (
    <p role="status" className="feedback">
      {pending && <LoaderCircle className="spin" size={16} />} {message}
    </p>
  ) : null;
}
