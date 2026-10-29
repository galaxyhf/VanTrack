'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, ArrowUpRight } from 'lucide-react';
import { api, patch } from '@/lib/api';
import type { List, Notification } from '@/lib/types';
import { dateTime } from '@/lib/utils';
import { Loading, ErrorState, Empty } from './states';
import { Button } from './ui/button';
export function NotificationsPage() {
  const client = useQueryClient();
  const [type, setType] = useState(''),
    [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['notifications', type],
    queryFn: () =>
      api<List<Notification>>(
        `/notifications?limit=100${type ? '&type=' + encodeURIComponent(type) : ''}`,
      ),
    refetchInterval: 15000,
  });
  return (
    <div id="content">
      <div className="page-heading">
        <div>
          <p className="greeting">Fique por dentro</p>
          <h1>Notificações</h1>
          <p>O que mudou no seu trajeto, em um só lugar.</p>
        </div>
        <label>
          Filtrar por tipo
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Todas</option>
            <option value="reservation:created">Reservas confirmadas</option>
            <option value="reservation:cancelled">Reservas canceladas</option>
            <option value="trip:delay">Atrasos</option>
            <option value="trip:message">Mensagens</option>
            <option value="waitlist:offered">Vagas liberadas</option>
          </select>
        </label>
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.data.length ? (
        <div className="panel notification-list">
          {query.data.data.map((n) => (
            <article key={n.id} className={n.isRead ? '' : 'unread'}>
              <span className="notification-icon">
                <Bell size={19} />
              </span>
              <div>
                <strong>{n.title}</strong>
                <p>{n.content}</p>
                <small>
                  {dateTime(n.createdAt)} · {n.isRead ? 'Lida' : 'Não lida'}
                </small>
                {n.tripId && (
                  <Link href={`/app/viagens/${n.tripId}`}>
                    Abrir viagem <ArrowUpRight size={14} />
                  </Link>
                )}
              </div>
              {!n.isRead && (
                <Button
                  variant="ghost"
                  aria-label={`Marcar como lida: ${n.title}`}
                  onClick={async () => {
                    try {
                      await patch(`/notifications/${n.id}/read`, {});
                      await client.invalidateQueries({ queryKey: ['notifications'] });
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  <Check size={17} />
                  <span>Marcar como lida</span>
                </Button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Tudo em dia por aqui"
          description="Avisos de viagens, reservas e novas mensagens aparecerão aqui."
        />
      )}
    </div>
  );
}
