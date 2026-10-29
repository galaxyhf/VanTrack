'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { connectRealtime } from '@/lib/realtime';
import { MessageSquare, Send, Megaphone, BusFront } from 'lucide-react';
import { api, post } from '@/lib/api';
import type { User, Trip, List, Message } from '@/lib/types';
import { time } from '@/lib/utils';
import { Loading, ErrorState, Empty } from './states';
import { Button } from './ui/button';
export function ChatPage() {
  const params = useSearchParams(),
    client = useQueryClient();
  const [selected, setSelected] = useState(params.get('viagem') ?? ''),
    [content, setContent] = useState(''),
    [operational, setOperational] = useState(false),
    [error, setError] = useState(''),
    [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<User>('/auth/me') });
  const trips = useQuery({
    queryKey: ['chat-trips'],
    queryFn: () => api<List<Trip>>('/trips?limit=100&participantsOnly=true'),
  });
  const id = selected || trips.data?.data[0]?.id;
  const messages = useQuery({
    queryKey: ['messages', id],
    queryFn: () => api<List<Message>>(`/trips/${id}/messages?limit=100`),
    enabled: !!id,
    refetchInterval: 15000,
  });
  useEffect(() => {
    if (!id) return;
    const s = connectRealtime();
    s.on('connect', () => {
      s.emit('trip:join', { tripId: id });
      void client.invalidateQueries({ queryKey: ['messages', id] });
    });
    s.on('trip:message', () => {
      void client.invalidateQueries({ queryKey: ['messages', id] });
    });
    return () => {
      s.disconnect();
    };
  }, [id, client]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'instant', block: 'nearest' });
    if (id && messages.data)
      void post(`/trips/${id}/messages/read`)
        .then(() => client.invalidateQueries({ queryKey: ['unread-messages'] }))
        .catch(() => undefined);
  }, [messages.data, id, client]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || !id) return;
    setSending(true);
    setError('');
    try {
      await post(`/trips/${id}/messages`, { content, operational });
      setContent('');
      await client.invalidateQueries({ queryKey: ['messages', id] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }
  return (
    <div id="content">
      <div className="page-heading">
        <div>
          <p className="greeting">Todo mundo no mesmo caminho</p>
          <h1>Mensagens</h1>
          <p>Converse com os participantes e acompanhe os avisos da viagem.</p>
        </div>
      </div>
      <div className="chat-layout">
        <aside className="chat-trip-list">
          <h2>Suas viagens</h2>
          {trips.data?.data.map((t) => (
            <button
              key={t.id}
              className={id === t.id ? 'selected' : ''}
              onClick={() => setSelected(t.id)}
            >
              <BusFront size={20} />
              <span>
                <strong>{t.route.name}</strong>
                <small>
                  {time(t.scheduledDeparture)} · {t.vehicle.internalCode}
                </small>
              </span>
            </button>
          ))}
        </aside>
        <section className="chat-panel">
          <div className="chat-header">
            <MessageSquare size={20} />
            <h2>
              {trips.data?.data.find((t) => t.id === id)?.route.name ?? 'Mensagens da viagem'}
            </h2>
            <span className="subtle">Conversa privada</span>
          </div>
          <div className="chat-messages" aria-live="polite">
            {messages.isPending ? (
              <Loading />
            ) : messages.error ? (
              <ErrorState error={messages.error} retry={() => void messages.refetch()} />
            ) : !messages.data.data.length ? (
              <Empty
                title="A conversa começa aqui"
                description="Combine seu embarque e acompanhe os avisos do motorista."
              />
            ) : (
              messages.data.data.map((m) => (
                <article
                  key={m.id}
                  className={`chat-message ${m.senderId === me.data?.id ? 'own' : ''} ${m.operational ? 'operational' : ''}`}
                >
                  <div>
                    <strong>
                      {m.operational && <Megaphone size={14} />} {m.senderName}
                    </strong>
                    <time>{time(m.createdAt)}</time>
                  </div>
                  <p>{m.content}</p>
                </article>
              ))
            )}
            <div ref={bottom} />
          </div>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <form className="chat-composer" onSubmit={send}>
            {me.data?.role !== 'teacher' && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={operational}
                  onChange={(e) => setOperational(e.target.checked)}
                />
                <Megaphone size={15} />
                Enviar como aviso operacional
              </label>
            )}
            <div>
              <input
                aria-label="Sua mensagem"
                placeholder="Escreva para os participantes…"
                maxLength={2000}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={!id}
              />
              <Button
                type="submit"
                aria-label="Enviar mensagem"
                disabled={sending || !content.trim() || !id}
              >
                <Send size={18} />
                <span>Enviar</span>
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
