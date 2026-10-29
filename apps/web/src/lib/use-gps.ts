'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { connectRealtime } from './realtime';
import { post } from './api';
import { haversine } from '@vantrack/shared';
type WakeLock = { release(): Promise<void> };
export function useGps(tripId: string) {
  const [sharing, setSharing] = useState(false),
    [error, setError] = useState(''),
    [accuracy, setAccuracy] = useState<number | null>(null),
    [last, setLast] = useState<string | null>(null);
  const watch = useRef<number | null>(null),
    socket = useRef<Socket | null>(null),
    lock = useRef<WakeLock | null>(null),
    previous = useRef<{ lat: number; lon: number; time: number } | null>(null),
    pendingPosition = useRef<GeolocationPosition | null>(null),
    generation = useRef(0),
    starting = useRef(false);
  const stopLocal = useCallback(() => {
    generation.current++;
    starting.current = false;
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    previous.current = null;
    pendingPosition.current = null;
    socket.current?.disconnect();
    socket.current = null;
    void lock.current?.release();
    lock.current = null;
    setSharing(false);
  }, []);
  const stop = useCallback(async () => {
    stopLocal();
    await post(`/trips/${tripId}/tracking-consent`, { enabled: false }).catch(() =>
      setError(
        'Sem conexão. O compartilhamento local parou; o servidor identificará a localização como desatualizada.',
      ),
    );
  }, [tripId, stopLocal]);
  const start = useCallback(async () => {
    setError('');
    if (!navigator.geolocation) {
      setError('Este navegador não oferece geolocalização.');
      return;
    }
    if (!window.isSecureContext) {
      setError('Abra em HTTPS ou localhost para compartilhar sua localização.');
      return;
    }
    if (starting.current || socket.current) return;
    starting.current = true;
    const attempt = ++generation.current;
    try {
      await post(`/trips/${tripId}/tracking-consent`, { enabled: true });
      if (generation.current !== attempt) {
        void post(`/trips/${tripId}/tracking-consent`, { enabled: false }).catch(() => undefined);
        return;
      }
      const s = connectRealtime();
      socket.current = s;
      s.on('exception', () =>
        setError('O servidor não aceitou a localização. Verifique a sessão e a viagem.'),
      );
      s.on('disconnect', () =>
        setError('Sem conexão. Tentando reconectar; apenas posições recentes serão enviadas.'),
      );
      s.on('connect', () => {
        setError('');
        const pending = pendingPosition.current;
        if (pending) {
          pendingPosition.current = null;
          transmit(pending);
        }
      });
      setSharing(true);
      if ('wakeLock' in navigator)
        void navigator.wakeLock
          .request('screen')
          .then((wake) => {
            if (watch.current !== null) lock.current = wake;
            else void wake.release();
          })
          .catch(() =>
            setError('Mantenha a tela ativa; o navegador não permitiu impedir o bloqueio.'),
          );
      const transmit = (position: GeolocationPosition) => {
        const p = position.coords,
          now = position.timestamp,
          prev = previous.current;
        if (p.accuracy > 500) {
          setError('Precisão baixa. Aguardando um sinal GPS melhor.');
          return;
        }
        if (
          prev &&
          (now - prev.time < 5000 ||
            (haversine([prev.lat, prev.lon], [p.latitude, p.longitude]) < 10 &&
              now - prev.time < 25000))
        )
          return;
        setAccuracy(p.accuracy);
        if (!s.connected) {
          pendingPosition.current = position;
          return;
        }
        if (Date.now() - now > 120000) return;
        previous.current = { lat: p.latitude, lon: p.longitude, time: now };
        s.timeout(8000).emit(
          'vehicle:location',
          {
            tripId,
            latitude: p.latitude,
            longitude: p.longitude,
            accuracy: p.accuracy,
            speed: p.speed,
            heading: p.heading,
            recordedAt: new Date(now).toISOString(),
          },
          (err: Error | null, result: { accepted?: boolean }) => {
            if (!err && result?.accepted) {
              setLast(new Date().toISOString());
              setError('');
            } else if (err) setError('Não foi possível enviar a posição. Tentando novamente.');
          },
        );
      };
      watch.current = navigator.geolocation.watchPosition(
        transmit,
        (e) => {
          setError(
            e.code === 1
              ? 'Permissão de localização negada. Libere o acesso nas configurações do navegador.'
              : 'Sinal GPS indisponível. Tente em uma área aberta.',
          );
          if (e.code === 1) void stop();
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível ativar o GPS');
      stopLocal();
    } finally {
      starting.current = false;
    }
  }, [tripId, stop, stopLocal]);
  useEffect(
    () => () => {
      const active = watch.current !== null;
      stopLocal();
      if (active)
        void post(`/trips/${tripId}/tracking-consent`, { enabled: false }).catch(() => undefined);
    },
    [tripId, stopLocal],
  );
  return { sharing, error, accuracy, last, start, stop };
}
