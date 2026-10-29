'use client';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, post } from '@/lib/api';
import type { List, Reservation } from '@/lib/types';
import { dateTime } from '@/lib/utils';
import { Button } from './ui/button';
import { Status } from './status';
import { Loading, ErrorState } from './states';
export function AdminReservations() {
  const client = useQueryClient(),
    [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['admin-reservations'],
    queryFn: () =>
      api<List<{ reservation: Reservation; user: { id: string; name: string } }>>(
        '/admin/reservations?limit=100',
      ),
  });
  return (
    <div id="content">
      <Link href="/app/gestao" className="back-link">
        ← Gestão operacional
      </Link>
      <div className="page-heading">
        <div>
          <h1>Reservas da operação</h1>
          <p>Consulte os passageiros e gerencie cancelamentos.</p>
        </div>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <div className="panel table-scroll">
          <table>
            <thead>
              <tr>
                <th>Passageiro</th>
                <th>Solicitada em</th>
                <th>Estado</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {query.data.data.map(({ reservation: r, user }) => (
                <tr key={r.id}>
                  <td>{user.name}</td>
                  <td>{dateTime(r.createdAt)}</td>
                  <td>
                    <Status value={r.status} />
                  </td>
                  <td>
                    <div className="button-row">
                      <Link href={`/app/viagens/${r.tripId}`}>Abrir viagem</Link>
                      {r.status === 'confirmed' && (
                        <Button
                          variant="ghost"
                          onClick={async () => {
                            if (!window.confirm('Cancelar esta reserva?')) return;
                            try {
                              await post(`/reservations/${r.id}/cancel`);
                              await client.invalidateQueries();
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          Cancelar reserva
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
