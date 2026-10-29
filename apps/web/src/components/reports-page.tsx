'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { Download, CalendarDays, BusFront, UsersRound, Clock3, Ban } from 'lucide-react';
import { api, API } from '@/lib/api';
import type { List } from '@/lib/types';
import type { Report } from './dashboard';
import { Button } from './ui/button';
import { Loading, ErrorState, Empty } from './states';
import { Status } from './status';
export function ReportsPage() {
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [vehicle, setVehicle] = useState(''),
    [route, setRoute] = useState(''),
    [driver, setDriver] = useState('');
  const options = useQuery({
    queryKey: ['report-options'],
    queryFn: async () => {
      const [vehicles, routes, users] = await Promise.all([
        api<List<{ id: string; internalCode: string }>>('/vehicles?limit=100'),
        api<List<{ id: string; name: string }>>('/routes?limit=100'),
        api<List<{ id: string; name: string; role: string }>>('/users?limit=100'),
      ]);
      return {
        vehicles: vehicles.data,
        routes: routes.data,
        drivers: users.data.filter((u) => u.role === 'driver'),
      };
    },
  });
  const params = new URLSearchParams();
  if (from) params.set('from', new Date(from + 'T00:00:00-03:00').toISOString());
  if (to) params.set('to', new Date(to + 'T23:59:59-03:00').toISOString());
  if (vehicle) params.set('vehicleId', vehicle);
  if (route) params.set('routeId', route);
  if (driver) params.set('driverId', driver);
  const qs = params.toString();
  const query = useQuery({
    queryKey: ['reports', qs],
    queryFn: () => api<Report>('/admin/reports?' + qs),
  });
  return (
    <div id="content">
      <div className="page-heading">
        <div>
          <p className="greeting">Entenda seus caminhos</p>
          <h1>Relatórios da operação</h1>
          <p>Viagens, ocupação e pontualidade com dados da sua operação.</p>
        </div>
        <Button variant="outline" asChild>
          <a href={`${API}/admin/reports.csv?${qs}`} download>
            <Download size={17} />
            Exportar CSV
          </a>
        </Button>
      </div>
      <div className="filter-bar report-filters">
        <label>
          De
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Até
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          Veículo
          <select value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
            <option value="">Todos</option>
            {options.data?.vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.internalCode}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rota
          <select value={route} onChange={(e) => setRoute(e.target.value)}>
            <option value="">Todas</option>
            {options.data?.routes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Motorista
          <select value={driver} onChange={(e) => setDriver(e.target.value)}>
            <option value="">Todos</option>
            {options.data?.drivers.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <div className="metrics-strip">
            {[
              { label: 'Viagens concluídas', value: query.data.summary.completed, icon: BusFront },
              {
                label: 'Passageiros confirmados',
                value: query.data.summary.reservations,
                icon: UsersRound,
              },
              {
                label: 'Atraso médio na chegada',
                value: query.data.summary.average_delay + ' min',
                icon: Clock3,
              },
              { label: 'Viagens canceladas', value: query.data.summary.cancelled, icon: Ban },
            ].map((x) => (
              <div className="metric" key={x.label}>
                <div className="metric-label">
                  {x.label}
                  <x.icon size={17} />
                </div>
                <strong>{x.value}</strong>
              </div>
            ))}
          </div>
          <div className="chart-grid">
            <section className="panel">
              <h2>Viagens por dia</h2>
              {query.data.series.length ? (
                <div
                  className="chart-container"
                  role="img"
                  aria-label="Quantidade de viagens por dia"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={query.data.series}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="day" fontSize={12} stroke="var(--muted)" />
                      <YAxis allowDecimals={false} fontSize={12} stroke="var(--muted)" />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--surface)',
                          borderColor: 'var(--border)',
                          borderRadius: 8,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="trips"
                        name="Viagens"
                        stroke="#2563eb"
                        fill="#2563eb"
                        fillOpacity={0.09}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty />
              )}
            </section>
            <section className="panel">
              <h2>Ocupação média (%)</h2>
              <div className="chart-container" role="img" aria-label="Ocupação média das viagens">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={query.data.series}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="day" fontSize={12} stroke="var(--muted)" />
                    <YAxis domain={[0, 100]} fontSize={12} stroke="var(--muted)" />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                    />
                    <Bar
                      dataKey="occupancy"
                      name="Ocupação %"
                      fill="#2563eb"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={24}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
          <section className="panel table-scroll">
            <h2>
              <CalendarDays size={19} />
              Detalhamento das viagens
            </h2>
            <p className="subtle">
              Até 1.000 registros por consulta. Dados demonstrativos identificados na exportação.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Rota</th>
                  <th>Motorista</th>
                  <th>Veículo</th>
                  <th>Passageiros</th>
                  <th>Cancelamentos</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {query.data.data.map((r) => (
                  <tr key={String(r.id)}>
                    <td>
                      {String(r.route)}
                      {r.is_demo ? ' · Demo' : ''}
                    </td>
                    <td>{String(r.driver)}</td>
                    <td>{String(r.plate)}</td>
                    <td>{String(r.passengers)}</td>
                    <td>{String(r.cancellations)}</td>
                    <td>
                      <Status value={String(r.status)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
