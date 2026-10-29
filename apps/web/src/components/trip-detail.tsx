'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  UsersRound,
  MessageSquare,
  Play,
  Square,
  Pause,
  Navigation,
  AlertTriangle,
  Radio,
  CheckCircle2,
  BusFront,
  RefreshCcw,
  Info,
  Flag,
} from 'lucide-react';
import { api, post } from '@/lib/api';
import type { Trip, User } from '@/lib/types';
import { time, dateTime } from '@/lib/utils';
import { useGps } from '@/lib/use-gps';
import { TripMap } from './trip-map';
import { Status } from './status';
import { Loading, ErrorState, Feedback } from './states';
import { Button } from './ui/button';
export function TripDetail({ id }: { id: string }) {
  const client = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<User>('/auth/me') });
  const query = useQuery({
    queryKey: ['trip', id],
    queryFn: () => api<Trip>(`/trips/${id}`),
    refetchInterval: 30000,
  });
  const [stop, setStop] = useState(''),
    [feedback, setFeedback] = useState(''),
    [pending, setPending] = useState(false),
    [delay, setDelay] = useState(false),
    [incident, setIncident] = useState(false),
    [confirmFinish, setConfirmFinish] = useState(false);
  const gps = useGps(id);
  async function action(path: string, body?: unknown) {
    setPending(true);
    setFeedback('');
    try {
      await post(path, body);
      await client.invalidateQueries();
      setFeedback('Pronto. Informações atualizadas.');
    } catch (e) {
      setFeedback(e instanceof Error ? e.message : 'Não foi possível concluir');
    } finally {
      setPending(false);
    }
  }
  if (query.isPending || me.isPending) return <Loading />;
  if (query.error || me.error)
    return <ErrorState error={query.error ?? me.error} retry={() => void query.refetch()} />;
  const trip = query.data!,
    user = me.data!,
    staff = user.role !== 'teacher',
    driver = user.role === 'driver' && trip.driverId === user.id;
  const authorized = staff || !!trip.myReservation;
  const boardingPoints = trip.stops?.filter((s) => ['boarding', 'both'].includes(s.kind)) ?? [];
  return (
    <div id="content">
      <Link href="/app" className="back-link">
        <ArrowLeft size={16} />
        Voltar às viagens
      </Link>
      <div className="page-heading detail-heading">
        <div>
          <p className="greeting">
            {trip.vehicle.internalCode} · {dateTime(trip.scheduledDeparture)}
          </p>
          <h1>{trip.route.name}</h1>
          <p>
            {trip.driver.name} no volante · {trip.vehicle.model} · {trip.vehicle.plate}
          </p>
        </div>
        <Status value={trip.status} />
      </div>
      {trip.isDemo && (
        <div className="info-banner">
          <Info size={18} />
          <span>Viagem de demonstração. Pontos ilustrativos e localização simulada.</span>
        </div>
      )}
      <div className="detail-grid">
        <div>
          <TripMap trip={trip} authorized={authorized} />
          <section className="panel itinerary">
            <div className="section-heading">
              <h2>Seu itinerário</h2>
              <span className="subtle">
                {Math.round(trip.route.estimatedDistance / 1000)} km estimados
              </span>
            </div>
            {trip.stops?.map((s, i) => (
              <div key={s.id} className="itinerary-stop">
                <span className="stop-number">{i + 1}</span>
                <div>
                  <strong>{s.name}</strong>
                  <p>{s.address}</p>
                </div>
              </div>
            ))}
          </section>
          {staff && trip.passengers && (
            <section className="panel">
              <div className="section-heading">
                <h2>Passageiros</h2>
                <span>{trip.passengers.length} confirmados</span>
              </div>
              {trip.passengers.map((p) => (
                <div className="passenger" key={p.id}>
                  <span className="avatar">{p.name[0]}</span>
                  <div>
                    <strong>{p.name}</strong>
                    <Status value={p.status} />
                  </div>
                  {['boarding', 'in_progress'].includes(trip.status) &&
                    ['confirmed', 'boarded'].includes(p.status) && (
                      <Button
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          void action(`/reservations/${p.id}/attendance`, {
                            status: p.status === 'confirmed' ? 'boarded' : 'alighted',
                          })
                        }
                      >
                        <CheckCircle2 size={16} />
                        {p.status === 'confirmed' ? 'Confirmar embarque' : 'Confirmar desembarque'}
                      </Button>
                    )}
                </div>
              ))}
            </section>
          )}
        </div>
        <aside className="detail-aside">
          <section className="panel reservation-panel">
            <h2>{trip.myReservation ? 'Sua reserva' : 'Informações da viagem'}</h2>
            <div className="time-route">
              <div>
                <small>Saída prevista</small>
                <strong>{time(trip.scheduledDeparture)}</strong>
                <span>{trip.route.origin}</span>
              </div>
              <span>→</span>
              <div>
                <small>Chegada prevista</small>
                <strong>{time(trip.scheduledArrival)}</strong>
                <span>{trip.route.destination}</span>
              </div>
            </div>
            <div className="capacity-display">
              <UsersRound size={19} />
              <strong>{trip.available} vagas disponíveis</strong>
              <span>de {trip.vehicle.capacity}</span>
            </div>
            {user.role === 'teacher' &&
              !trip.myReservation &&
              ['scheduled', 'boarding'].includes(trip.status) && (
                <div className="form-stack">
                  <label>
                    Ponto de embarque
                    <select value={stop} onChange={(e) => setStop(e.target.value)}>
                      <option value="">Selecione um ponto</option>
                      {boardingPoints.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    disabled={!stop || pending}
                    onClick={() =>
                      void action(trip.available ? '/reservations' : '/waitlist', {
                        tripId: id,
                        boardingStopId: stop,
                      })
                    }
                  >
                    {trip.available ? 'Confirmar minha vaga' : 'Entrar na lista de espera'}
                  </Button>
                  <small>Cancelamento sujeito ao prazo configurado pela operação.</small>
                </div>
              )}
            {trip.myReservation && (
              <div className="reservation-confirmed">
                <CheckCircle2 size={19} />
                <span>Sua vaga está confirmada</span>
                <Button asChild variant="outline">
                  <Link href="/app/reservas">Gerenciar reserva</Link>
                </Button>
              </div>
            )}
            {authorized && (
              <Button asChild variant="outline">
                <Link href={`/app/mensagens?viagem=${id}`}>
                  <MessageSquare size={17} />
                  Mensagens da viagem
                </Link>
              </Button>
            )}
          </section>
          {staff && (
            <section className="panel driver-controls">
              <h2>Controle da viagem</h2>
              {trip.status === 'scheduled' && (
                <Button
                  size="lg"
                  disabled={pending}
                  onClick={() => void action(`/trips/${id}/boarding`)}
                >
                  <UsersRound size={19} />
                  Abrir embarque
                </Button>
              )}
              {trip.status === 'boarding' && (
                <Button
                  size="lg"
                  disabled={pending}
                  onClick={() => void action(`/trips/${id}/start`)}
                >
                  <Play size={19} />
                  Iniciar viagem
                </Button>
              )}
              {trip.status === 'in_progress' && (
                <>
                  {driver && !trip.isDemo && (
                    <>
                      <p className="tracking-info">
                        <Radio size={17} />
                        {gps.sharing ? 'Compartilhando localização' : 'Localização pausada'}
                      </p>
                      <p className="subtle">
                        {gps.accuracy
                          ? `Precisão de ${Math.round(gps.accuracy)} m`
                          : 'GPS ainda não ativado'}
                        {gps.last ? ` · Enviado às ${time(gps.last)}` : ''}
                      </p>
                      <Button
                        size="lg"
                        onClick={() => void (gps.sharing ? gps.stop() : gps.start())}
                      >
                        {gps.sharing ? <Pause size={19} /> : <Navigation size={19} />}{' '}
                        {gps.sharing ? 'Pausar compartilhamento' : 'Autorizar e compartilhar GPS'}
                      </Button>
                      {gps.error && (
                        <p role="alert" className="field-error">
                          {gps.error}
                        </p>
                      )}
                      <p className="small-note">
                        <Info size={16} />O navegador pode suspender o GPS com a tela bloqueada ou
                        fechada. Mantenha a página aberta e a tela ativa. Você pode interromper o
                        compartilhamento a qualquer momento.
                      </p>
                    </>
                  )}
                  {trip.isDemo && (
                    <div className="simulator-controls">
                      <p>
                        <BusFront size={17} />
                        Simulador GPS
                      </p>
                      <div className="button-row">
                        <Button
                          variant="outline"
                          disabled={pending}
                          onClick={() => void action(`/trips/${id}/simulator`, { action: 'start' })}
                        >
                          <Play size={15} />
                          Iniciar
                        </Button>
                        <Button
                          variant="outline"
                          disabled={pending}
                          onClick={() => void action(`/trips/${id}/simulator`, { action: 'pause' })}
                        >
                          <Pause size={15} />
                          Pausar
                        </Button>
                        <Button
                          variant="outline"
                          disabled={pending}
                          onClick={() =>
                            void action(`/trips/${id}/simulator`, { action: 'resume' })
                          }
                        >
                          Continuar
                        </Button>
                        <Button
                          variant="outline"
                          disabled={pending}
                          onClick={() => void action(`/trips/${id}/simulator`, { action: 'reset' })}
                        >
                          <RefreshCcw size={15} />
                          Reiniciar
                        </Button>
                        <Button
                          variant="outline"
                          disabled={pending}
                          onClick={() => void action(`/trips/${id}/simulator`, { action: 'delay' })}
                        >
                          Simular parada
                        </Button>
                      </div>
                      <label>
                        Velocidade
                        <select
                          defaultValue="1"
                          onChange={(e) =>
                            void action(`/trips/${id}/simulator`, {
                              action: 'speed',
                              speed: Number(e.target.value),
                            })
                          }
                        >
                          <option value="1">1×</option>
                          <option value="5">5×</option>
                          <option value="20">20×</option>
                        </select>
                      </label>
                    </div>
                  )}
                  <Button size="lg" variant="outline" onClick={() => setDelay(!delay)}>
                    <AlertTriangle size={18} />
                    Informar atraso
                  </Button>
                  {delay && (
                    <form
                      className="form-stack"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void action(`/trips/${id}/delay`, {
                          minutes: Number(f.get('minutes')),
                          description: f.get('description'),
                        });
                      }}
                    >
                      <label>
                        Atraso em minutos
                        <input
                          name="minutes"
                          type="number"
                          min="1"
                          max="240"
                          defaultValue="10"
                          required
                        />
                      </label>
                      <label>
                        Motivo
                        <input name="description" minLength={3} maxLength={500} required />
                      </label>
                      <Button disabled={pending}>Enviar aviso</Button>
                    </form>
                  )}
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={() => setConfirmFinish(!confirmFinish)}
                  >
                    <Square size={17} />
                    Encerrar viagem
                  </Button>
                  {confirmFinish && (
                    <div className="confirmation">
                      <p>Confirmar a chegada ao destino e encerrar o rastreamento?</p>
                      <Button
                        disabled={pending}
                        onClick={async () => {
                          await gps.stop();
                          await action(`/trips/${id}/finish`);
                          setConfirmFinish(false);
                        }}
                      >
                        Confirmar encerramento
                      </Button>
                    </div>
                  )}
                </>
              )}
              {['scheduled', 'boarding'].includes(trip.status) && user.role === 'admin' && (
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={() => {
                    if (window.confirm('Cancelar esta viagem e avisar todos os passageiros?'))
                      void action(`/trips/${id}/cancel`);
                  }}
                >
                  Cancelar viagem
                </Button>
              )}
              <Button variant="ghost" onClick={() => setIncident(!incident)}>
                <Flag size={16} />
                Registrar ocorrência
              </Button>
              {incident && (
                <form
                  className="form-stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action(`/trips/${id}/incidents`, {
                      description: new FormData(e.currentTarget).get('description'),
                    });
                  }}
                >
                  <label>
                    Descrição
                    <textarea name="description" minLength={5} maxLength={1000} required />
                  </label>
                  <Button disabled={pending}>Registrar</Button>
                </form>
              )}
            </section>
          )}
          <Feedback message={pending ? 'Salvando…' : feedback} pending={pending} />
        </aside>
      </div>
    </div>
  );
}
