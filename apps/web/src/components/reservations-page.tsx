'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ticket, MapPin, Clock3, ArrowUpRight } from 'lucide-react';
import { api, post } from '@/lib/api';
import type { Reservation, Trip, Route, Stop } from '@/lib/types';
import { dateTime } from '@/lib/utils';
import { Loading, ErrorState, Empty, Feedback } from './states';
import { Status } from './status';
import { Button } from './ui/button';
type Data = {
  data: { reservation: Reservation; trip: Trip; route: Route; stop: Stop }[];
  waitlist: {
    entry: { id: string; status: string; position: number; offerExpiresAt: string | null };
    trip: Trip;
    route: Route;
  }[];
};
export function ReservationsPage() {
  const client = useQueryClient();
  const [message, setMessage] = useState(''),
    [pending, setPending] = useState(false);
  const query = useQuery({
    queryKey: ['reservations'],
    queryFn: () => api<Data>('/reservations/me'),
    refetchInterval: 15000,
  });
  async function action(path: string) {
    setPending(true);
    try {
      await post(path);
      await client.invalidateQueries();
      setMessage('Reserva atualizada.');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <div id="content">
      <div className="page-heading">
        <div>
          <p className="greeting">Seu lugar no caminho</p>
          <h1>Minhas reservas</h1>
          <p>Vagas confirmadas e lista de espera.</p>
        </div>
        <Button asChild>
          <Link href="/app/viagens">
            Reservar uma vaga
            <ArrowUpRight size={16} />
          </Link>
        </Button>
      </div>
      <Feedback message={message} />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <div className="reservation-grid">
            {query.data.waitlist.map(({ entry, trip, route }) => (
              <article className="panel" key={entry.id}>
                <Status value={entry.status} />
                <h2>{route.name}</h2>
                <p>{dateTime(trip.scheduledDeparture)}</p>
                <p>Posição na fila: {entry.position}</p>
                {entry.status === 'offered' && entry.offerExpiresAt && (
                  <>
                    <p>Confirme até {dateTime(entry.offerExpiresAt)}</p>
                    <Button
                      disabled={pending}
                      onClick={() => void action(`/waitlist/${entry.id}/accept`)}
                    >
                      Confirmar minha vaga
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  disabled={pending}
                  onClick={() => void action(`/waitlist/${entry.id}/leave`)}
                >
                  Sair da lista de espera
                </Button>
              </article>
            ))}
            {query.data.data.map(({ reservation, trip, route, stop }) => (
              <article className="panel reservation-card" key={reservation.id}>
                <div className="section-heading">
                  <Ticket size={22} />
                  <Status value={reservation.status} />
                </div>
                <h2>{route.name}</h2>
                <p>
                  <Clock3 size={16} />
                  {dateTime(trip.scheduledDeparture)}
                </p>
                <p>
                  <MapPin size={16} />
                  {stop.name}
                </p>
                <div className="button-row">
                  <Button asChild variant="outline">
                    <Link href={`/app/viagens/${trip.id}`}>
                      Acompanhar viagem
                      <ArrowUpRight size={15} />
                    </Link>
                  </Button>
                  {reservation.status === 'confirmed' && (
                    <Button
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        if (window.confirm('Cancelar sua reserva e liberar a vaga?'))
                          void action(`/reservations/${reservation.id}/cancel`);
                      }}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!query.data.data.length && !query.data.waitlist.length && (
            <Empty
              title="Sua próxima viagem começa com uma reserva"
              description="Escolha o trajeto, o horário e o ponto de embarque na agenda de viagens."
            />
          )}
        </>
      )}
    </div>
  );
}
