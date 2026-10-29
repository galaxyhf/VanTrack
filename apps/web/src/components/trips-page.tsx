'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Search, CalendarDays } from 'lucide-react';
import { api } from '@/lib/api';
import type { List, Trip } from '@/lib/types';
import { TripList } from './dashboard';
import { Loading, ErrorState } from './states';
export function TripsPage() {
  const [date, setDate] = useState(''),
    [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['trips', 'browse', date, search],
    queryFn: () =>
      api<List<Trip>>(
        `/trips?limit=100&search=${encodeURIComponent(search)}${date ? `&from=${encodeURIComponent(new Date(date + 'T00:00:00-03:00').toISOString())}&to=${encodeURIComponent(new Date(date + 'T23:59:59-03:00').toISOString())}` : ''}`,
      ),
  });
  return (
    <div id="content">
      <div className="page-heading">
        <div>
          <p className="greeting">Sua agenda de transporte</p>
          <h1>Encontre seu próximo trajeto.</h1>
          <p>Horários, itinerários e vagas em um só lugar.</p>
        </div>
      </div>
      <div className="filter-bar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Buscar rota ou placa"
            placeholder="Buscar rota ou placa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="date-filter">
          <CalendarDays size={17} />
          <input
            aria-label="Data da viagem"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <TripList items={query.data.data} />
      )}
    </div>
  );
}
