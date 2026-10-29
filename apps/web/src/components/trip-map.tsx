'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { connectRealtime } from '@/lib/realtime';
import { Radio, WifiOff, MapPin, ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import type { Trip, Location, Eta } from '@/lib/types';
import { time } from '@/lib/utils';
const Map = dynamic(() => import('./map-canvas'), {
  ssr: false,
  loading: () => <div className="skeleton map-skeleton" />,
});
export function TripMap({
  trip,
  authorized = true,
  fleet = false,
}: {
  trip: Trip;
  authorized?: boolean;
  fleet?: boolean;
}) {
  const client = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(Date.now());
  const location = useQuery({
    queryKey: ['location', trip.id],
    queryFn: () =>
      api<{ location: Location | null; stale: boolean; paused: boolean }>(
        `/trips/${trip.id}/location`,
      ),
    enabled: authorized,
    refetchInterval: 15000,
  });
  const eta = useQuery({
    queryKey: ['eta', trip.id],
    queryFn: () => api<Eta>(`/trips/${trip.id}/eta`),
    enabled: authorized,
    refetchInterval: 30000,
  });
  const fleetQuery = useQuery({
    queryKey: ['fleet-live'],
    queryFn: () =>
      api<{ data: Array<Location & { tripId: string; label: string; paused: boolean }> }>(
        '/admin/live',
      ),
    enabled: fleet,
    refetchInterval: 15000,
  });
  const geometry = useQuery({
    queryKey: ['geometry', trip.id],
    queryFn: () =>
      api<{ geometry: [number, number][]; source: string }>(`/trips/${trip.id}/geometry`),
  });
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!authorized) return;
    const socket = connectRealtime();
    socket.on('connect', () => {
      socket.emit('trip:join', { tripId: trip.id }, (r: { ok: boolean }) => setConnected(!!r?.ok));
      void client.invalidateQueries();
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('vehicle:location', () => {
      void client.invalidateQueries({ queryKey: ['location', trip.id] });
    });
    socket.on(
      'trip:eta_updated',
      () => void client.invalidateQueries({ queryKey: ['eta', trip.id] }),
    );
    for (const event of [
      'vehicle:offline',
      'trip:started',
      'trip:finished',
      'reservation:created',
      'reservation:cancelled',
      'trip:delay',
    ])
      socket.on(event, () => void client.invalidateQueries());
    return () => {
      socket.disconnect();
    };
  }, [trip.id, authorized, client]);
  const age = location.data?.location
    ? Math.max(0, Math.floor((now - new Date(location.data.location.recordedAt).getTime()) / 1000))
    : null;
  const stale = !connected || location.data?.stale || age === null || age > 30;
  return (
    <section className="trip-map">
      <Map
        location={location.data?.location}
        locations={fleetQuery.data?.data
          .filter((p) => p.tripId !== trip.id)
          .map((p) => ({
            ...p,
            label: `${p.label} · ${p.paused || now - new Date(p.recordedAt).getTime() > 30000 ? 'Localização desatualizada' : 'Ao vivo'}`,
          }))}
        stops={trip.stops}
        geometry={geometry.data?.geometry}
      />
      <div className={`connection-pill ${stale ? 'connection-stale' : ''}`} role="status">
        {stale ? <WifiOff size={14} /> : <Radio size={14} />}{' '}
        {!authorized
          ? 'Localização disponível após a reserva'
          : location.error
            ? 'Não foi possível obter a localização'
            : age === null
              ? 'Aguardando localização'
              : stale
                ? `Localização desatualizada · há ${age < 60 ? `${age} s` : `${Math.floor(age / 60)} min`}`
                : `Ao vivo · atualizado há ${age} s`}
      </div>
      {trip.isDemo && <span className="demo-map-label">Demonstração · GPS simulado</span>}
      <div className="map-route-label">
        <MapPin size={15} />
        {trip.route.origin}
        <ArrowUpRight size={15} />
        {trip.route.destination}
      </div>
      <div className="eta-overlay">
        <div>
          <span className="small-label">Chegada estimada</span>
          <strong>{eta.data?.available && eta.data.arrival ? time(eta.data.arrival) : '—'}</strong>
        </div>
        <div className="eta-detail">
          <span>
            {eta.data?.available
              ? `${eta.data.minutes} min · ${((eta.data.distance ?? 0) / 1000).toFixed(1)} km`
              : (eta.data?.reason ?? 'Aguardando GPS')}
          </span>
          <small>
            {eta.data?.stale
              ? 'Estimativa desatualizada'
              : eta.data?.source === 'osrm'
                ? 'Estimativa por rota · sem trânsito em tempo real'
                : 'Estimativa aproximada · sem trânsito em tempo real'}
          </small>
        </div>
      </div>
    </section>
  );
}
export { Map as LiveMap };
