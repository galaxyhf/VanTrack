'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ShieldCheck, ScrollText } from 'lucide-react';
import { api, patch } from '@/lib/api';
import type { List } from '@/lib/types';
import { dateTime } from '@/lib/utils';
import { Loading, ErrorState, Feedback } from './states';
import { Button } from './ui/button';
export function SettingsPage() {
  const client = useQueryClient();
  const [message, setMessage] = useState(''),
    [pending, setPending] = useState(false);
  const query = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<List<{ key: string; value: number }>>('/admin/settings'),
  });
  const audit = useQuery({
    queryKey: ['audit'],
    queryFn: () =>
      api<
        List<{ id: string; action: string; entityType: string; actorId: string; createdAt: string }>
      >('/admin/audit?limit=100'),
  });
  const fields = [
    {
      key: 'cancellation_cutoff_minutes',
      label: 'Antecedência mínima para cancelar (minutos)',
      min: 0,
      max: 1440,
      default: 30,
    },
    {
      key: 'waitlist_offer_minutes',
      label: 'Prazo para confirmar uma vaga oferecida (minutos)',
      min: 1,
      max: 120,
      default: 15,
    },
    {
      key: 'location_retention_days',
      label: 'Retenção do histórico de localização (dias)',
      min: 1,
      max: 365,
      default: 30,
    },
  ];
  return (
    <div id="content">
      <div className="page-heading">
        <div>
          <p className="greeting">Regras claras, operação tranquila</p>
          <h1>Configurações e auditoria</h1>
          <p>Ajuste as políticas de reservas e privacidade.</p>
        </div>
      </div>
      <Feedback message={message} />
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} />
      ) : (
        <section className="panel settings-panel">
          <h2>
            <ShieldCheck size={20} />
            Políticas da operação
          </h2>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              const form = new FormData(e.currentTarget);
              try {
                await patch(
                  '/admin/settings',
                  Object.fromEntries(fields.map((f) => [f.key, Number(form.get(f.key))])),
                );
                await client.invalidateQueries();
                setMessage('Políticas atualizadas e alteração registrada na auditoria.');
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setPending(false);
              }
            }}
          >
            {fields.map((f) => (
              <label key={f.key}>
                {f.label}
                <input
                  type="number"
                  name={f.key}
                  min={f.min}
                  max={f.max}
                  required
                  defaultValue={query.data.data.find((s) => s.key === f.key)?.value ?? f.default}
                />
              </label>
            ))}
            <p className="small-note">
              O histórico de localização é excluído automaticamente pelo serviço da API. O
              rastreamento depende de consentimento e só ocorre durante a viagem.
            </p>
            <Button disabled={pending}>{pending ? 'Salvando…' : 'Salvar políticas'}</Button>
          </form>
        </section>
      )}
      <section className="panel table-scroll">
        <h2>
          <ScrollText size={20} />
          Registro administrativo
        </h2>
        {audit.isPending ? (
          <Loading />
        ) : audit.error ? (
          <ErrorState error={audit.error} />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Ação</th>
                <th>Entidade</th>
                <th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              {audit.data.data.map((a) => (
                <tr key={a.id}>
                  <td>{dateTime(a.createdAt)}</td>
                  <td>{a.action}</td>
                  <td>{a.entityType}</td>
                  <td className="monospace">{a.actorId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
