'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  BusFront,
  CalendarDays,
  UsersRound,
  Navigation,
  MapPin,
  Clock3,
  ChevronRight,
  CircleCheck,
  Info,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { User, Trip, List, Location } from '@/lib/types';
import { time, dateTime } from '@/lib/utils';
import { Loading, ErrorState, Empty } from './states';
import { Status } from './status';
import { TripMap } from './trip-map';
import { Button } from './ui/button';
type Summary = {
  vehicles: number;
  operating: number;
  teachers: number;
  scheduled: number;
  active: number;
  completed: number;
  cancelled: number;
  reservations: number;
  occupancy: number;
  delayed: number;
  average_delay: number;
};
export type Report = {
  summary: Summary;
  series: { day: string; trips: number; occupancy: number }[];
  data: Record<string, unknown>[];
};
export function Dashboard({
  monitor = false,
  history = false,
}: {
  monitor?: boolean;
  history?: boolean;
}) {
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<User>('/auth/me') });
  const list = useQuery({
    queryKey: ['trips', history],
    queryFn: () =>
      api<List<Trip>>(
        `/trips?limit=100${history ? '' : '&from=' + encodeURIComponent(new Date(Date.now() - 86400000).toISOString())}`,
      ),
    refetchInterval: 30000,
  });
  const admin = me.data?.role === 'admin';
  const summary = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<Report>('/admin/dashboard'),
    enabled: admin,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const items =
    list.data?.data
      .filter((t) =>
        history
          ? ['completed', 'cancelled'].includes(t.status)
          : !['completed', 'cancelled'].includes(t.status),
      )
      .sort((a, b) =>
        history
          ? new Date(b.scheduledDeparture).getTime() - new Date(a.scheduledDeparture).getTime()
          : Number(b.status === 'in_progress') - Number(a.status === 'in_progress') ||
            new Date(a.scheduledDeparture).getTime() - new Date(b.scheduledDeparture).getTime(),
      ) ?? [];
  const current = selected ?? items.find((t) => t.status === 'in_progress')?.id ?? items[0]?.id;
  const trip = useQuery({
    queryKey: ['trip', current],
    queryFn: () => api<Trip>(`/trips/${current}`),
    enabled: !!current,
  });
  if (list.isPending || me.isPending) return <Loading />;
  if (list.error || me.error)
    return <ErrorState error={list.error ?? me.error} retry={() => void list.refetch()} />;
  const user = me.data!;
  return (
    <div id="content">
      <div className="page-heading">
        <div>
          <p className="greeting">
            {history
              ? 'Seus trajetos'
              : admin
                ? 'Centro de operação'
                : `Olá, ${user.name.split(' ')[0]}`}
          </p>
          <h1>
            {history
              ? 'Histórico de viagens'
              : monitor
                ? 'Monitoramento ao vivo'
                : admin
                  ? 'Visão geral'
                  : 'Seu próximo destino.'}
          </h1>
          <p>
            {history
              ? 'Consulte as viagens realizadas e canceladas.'
              : 'Rio de Janeiro e Teresópolis. Cada trajeto, mais perto.'}
          </p>
        </div>
        <Button asChild variant={admin ? 'default' : 'outline'}>
          <Link href={admin ? '/app/gestao?tipo=trips' : '/app/viagens'}>
            {admin ? <CalendarDays size={17} /> : <Navigation size={17} />}{' '}
            {admin ? 'Programar viagem' : 'Explorar viagens'}
            <ArrowUpRight size={16} />
          </Link>
        </Button>
      </div>
      {admin && !history && summary.error && (
        <ErrorState error={summary.error} retry={() => void summary.refetch()} />
      )}
      {admin && !history && summary.data && (
        <div className="metrics-strip">
          {[
            {
              label: 'Vans em operação',
              value: summary.data.summary.operating,
              total: `de ${summary.data.summary.vehicles} cadastradas`,
              icon: BusFront,
            },
            {
              label: 'Viagens programadas',
              value: summary.data.summary.scheduled,
              total: `${summary.data.summary.active} em andamento`,
              icon: CalendarDays,
            },
            {
              label: 'Reservas confirmadas',
              value: summary.data.summary.reservations,
              total: `${summary.data.summary.teachers} professores`,
              icon: UsersRound,
            },
            {
              label: 'Ocupação média',
              value: `${summary.data.summary.occupancy}%`,
              total: `${summary.data.summary.delayed} viagens com atraso`,
              icon: CircleCheck,
            },
          ].map((m) => (
            <div className="metric" key={m.label}>
              <div className="metric-label">
                <span>{m.label}</span>
                <m.icon size={17} />
              </div>
              <strong>{m.value}</strong>
              <small>{m.total}</small>
            </div>
          ))}
        </div>
      )}
      {history ? (
        <TripList items={items} />
      ) : items.length === 0 ? (
        <Empty />
      ) : (
        <>
          <div className="section-heading">
            <h2>
              {monitor
                ? 'Sua operação no mapa'
                : admin
                  ? 'Acompanhe a operação'
                  : 'Acompanhe sua viagem'}
            </h2>
            <span className="subtle">
              <span className="live-dot" />
              {items.filter((t) => t.status === 'in_progress').length} em andamento
            </span>
          </div>
          <div className="monitor-grid">
            <section className="trip-selector">
              <div className="selector-heading">
                <strong>Viagens</strong>
                <span>{items.length}</span>
              </div>
              <div className="trip-scroll">
                {items.map((t) => (
                  <button
                    className={`trip-option ${t.id === current ? 'selected' : ''}`}
                    key={t.id}
                    onClick={() => setSelected(t.id)}
                  >
                    <div className="trip-option-top">
                      <span>{t.vehicle.internalCode}</span>
                      <Status value={t.status} />
                    </div>
                    <h3>
                      {t.route.origin}
                      <ArrowRight size={15} />
                      {t.route.destination}
                    </h3>
                    <p>
                      <Clock3 size={13} />
                      {time(t.scheduledDeparture)} → {time(t.scheduledArrival)}
                      <span>·</span>
                      {t.occupied}/{t.vehicle.capacity} vagas
                    </p>
                    <div className="trip-option-bottom">
                      <span className="avatar avatar-small">{t.driver.name[0]}</span>
                      <span>{t.driver.name}</span>
                      <ChevronRight size={15} />
                    </div>
                  </button>
                ))}
              </div>
              <Link href="/app/viagens" className="selector-footer">
                Ver todas as viagens
                <ArrowRight size={15} />
              </Link>
            </section>
            <div className="monitor-map-wrapper">
              {trip.isPending ? (
                <Loading />
              ) : trip.error ? (
                <ErrorState error={trip.error} />
              ) : (
                trip.data && (
                  <>
                    <TripMap
                      fleet={admin}
                      trip={trip.data}
                      authorized={user.role !== 'teacher' || !!trip.data.myReservation}
                    />
                    <div className="trip-quickbar">
                      <div>
                        <BusFront size={21} />
                        <span>
                          <strong>{trip.data.vehicle.model}</strong>
                          <small>
                            {trip.data.vehicle.plate} · {trip.data.available} vagas disponíveis
                          </small>
                        </span>
                      </div>
                      <Button asChild>
                        <Link href={`/app/viagens/${trip.data.id}`}>
                          Abrir viagem
                          <ArrowUpRight size={16} />
                        </Link>
                      </Button>
                    </div>
                  </>
                )
              )}
            </div>
          </div>
          <div className="dashboard-bottom">
            <section>
              <div className="section-heading">
                <h2>Próximas saídas</h2>
                <Link href="/app/viagens">
                  Ver agenda <ArrowRight size={14} />
                </Link>
              </div>
              <TripList items={items.filter((t) => t.status === 'scheduled').slice(0, 3)} compact />
            </section>
            <aside className="route-note">
              <span className="note-icon">
                <MapPin size={23} />
              </span>
              <h3>
                Da serra à cidade.
                <br />
                Com tranquilidade.
              </h3>
              <p>Acompanhe o trajeto e combine o embarque em um só lugar.</p>
              <p className="small-note">
                <Info size={15} />
                Os pontos de demonstração não são endereços oficiais.
              </p>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
export function TripList({ items, compact = false }: { items: Trip[]; compact?: boolean }) {
  return items.length ? (
    <div className={`trip-table ${compact ? 'compact' : ''}`}>
      <div className="trip-table-head">
        <span>Trajeto e veículo</span>
        <span>Saída</span>
        <span>Ocupação</span>
        <span>Estado</span>
      </div>
      {items.map((t) => (
        <Link className="trip-row" href={`/app/viagens/${t.id}`} key={t.id}>
          <div>
            <strong>{t.route.name}</strong>
            <small>
              {t.vehicle.internalCode} · {t.driver.name}
              {t.isDemo ? ' · Demo' : ''}
            </small>
          </div>
          <span>{compact ? time(t.scheduledDeparture) : dateTime(t.scheduledDeparture)}</span>
          <span>
            {t.occupied}/{t.vehicle.capacity}
            <span className="occupancy-bar">
              <i style={{ width: `${(100 * t.occupied) / t.vehicle.capacity}%` }} />
            </span>
          </span>
          <Status value={t.status} />
          <ChevronRight size={16} />
        </Link>
      ))}
    </div>
  ) : (
    <Empty
      title="Sem viagens neste período"
      description="As saídas programadas e o histórico aparecem aqui."
    />
  );
}
export type { Location };
