'use client';
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Location, Stop } from '@/lib/types';
const van = L.divIcon({
  className: 'vehicle-map-icon',
  html: '<div class="van-marker"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 12h14M8 19v2m8-2v2M9 6h6M8 15h1m6 0h1"/></svg></div>',
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});
const stopIcon = L.divIcon({
  className: 'stop-map-icon',
  html: '<span></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});
function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = JSON.stringify(points);
  useEffect(() => {
    const coords = JSON.parse(key) as [number, number][];
    if (coords.length > 1)
      map.fitBounds(L.latLngBounds(coords), { padding: [50, 50], maxZoom: 13 });
    else if (coords.length) map.setView(coords[0], 12);
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(map.getContainer());
    return () => resize.disconnect();
  }, [map, key]);
  return null;
}
export default function MapCanvas({
  location,
  stops = [],
  geometry = [],
  locations = [],
}: {
  location?: Location | null;
  stops?: Stop[];
  geometry?: [number, number][];
  locations?: Array<Location & { label: string }>;
}) {
  const [tileError, setTileError] = useState(false);
  const points = stops.length
    ? stops.map((p) => [p.latitude, p.longitude] as [number, number])
    : locations.length
      ? locations.map((p) => [p.latitude, p.longitude] as [number, number])
      : ([
          [-22.9068, -43.1729],
          [-22.4122, -42.9656],
        ] as [number, number][]);
  return (
    <MapContainer
      center={[-22.65, -43.05]}
      zoom={9}
      scrollWheelZoom={false}
      className="map-canvas"
      aria-label="Mapa do trajeto"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        eventHandlers={{ tileerror: () => setTileError(true), tileload: () => setTileError(false) }}
      />
      {geometry.length > 1 && (
        <Polyline
          positions={geometry}
          pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.8 }}
        />
      )}
      {stops.map((p) => (
        <Marker key={p.id} position={[p.latitude, p.longitude]} icon={stopIcon}>
          <Popup>
            <strong>{p.name}</strong>
            <p>{p.address}</p>
            {p.isDemo && <p>Ponto de demonstração · não oficial</p>}
          </Popup>
        </Marker>
      ))}
      {location && (
        <Marker position={[location.latitude, location.longitude]} icon={van}>
          <Popup>
            {location.isSimulated ? 'Van · localização simulada' : 'Van'}
            <br />
            Precisão: {Math.round(location.accuracy)} m
          </Popup>
        </Marker>
      )}
      {locations.map((p, i) => (
        <Marker key={i} position={[p.latitude, p.longitude]} icon={van}>
          <Popup>
            {p.label}
            <br />
            {p.isSimulated ? 'Simulação' : 'GPS'} ·{' '}
            {new Date(p.recordedAt).toLocaleTimeString('pt-BR')}
          </Popup>
        </Marker>
      ))}
      <Fit points={points} />
      {tileError && (
        <div className="map-tile-error" role="status">
          Mapa indisponível. Verifique o acesso ao OpenStreetMap.
        </div>
      )}
    </MapContainer>
  );
}
