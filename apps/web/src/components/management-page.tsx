'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, X, Search, ArrowUpRight, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { api, post, patch } from '@/lib/api';
import type { User, List } from '@/lib/types';
import { dateTime } from '@/lib/utils';
import { resources, readKey, type Resource } from '@/lib/management';
import { Button } from './ui/button';
import { Status } from './status';
import { Loading, ErrorState, Empty } from './states';
type Row = Record<string, unknown> & { id: string };
export function ManagementPage() {
  const params = useSearchParams(),
    client = useQueryClient();
  const [type, setType] = useState(
      params.get('tipo') && resources[params.get('tipo')!] ? params.get('tipo')! : 'vehicles',
    ),
    [editing, setEditing] = useState<Row | null | undefined>(undefined),
    [search, setSearch] = useState(''),
    [error, setError] = useState('');
  const resource = resources[type];
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<User>('/auth/me') });
  const query = useQuery({
    queryKey: ['management', type, search],
    queryFn: () =>
      api<List<Row>>(`${resource.endpoint}?limit=100&search=${encodeURIComponent(search)}`),
    enabled: me.data?.role === 'admin',
  });
  if (me.data && me.data.role !== 'admin')
    return (
      <Empty
        title="Gestão restrita à administração"
        description="Seu perfil permite acompanhar viagens e gerenciar suas próprias atividades. Alterações na operação exigem um administrador."
      />
    );
  return (
    <div id="content">
      <div className="page-heading">
        <div>
          <p className="greeting">Tudo pronto para o próximo trajeto</p>
          <h1>Gestão operacional</h1>
          <p>Organize sua frota, sua equipe e os caminhos de cada dia.</p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setError('');
          }}
        >
          <Plus size={18} />
          Adicionar {resource.singular}
        </Button>
      </div>
      <div className="resource-tabs" role="tablist" aria-label="Tipo de cadastro">
        {Object.entries(resources).map(([key, r]) => (
          <button
            role="tab"
            aria-selected={type === key}
            key={key}
            className={type === key ? 'active' : ''}
            onClick={() => {
              setType(key);
              setEditing(undefined);
            }}
          >
            {r.label}
          </button>
        ))}
        <Link href="/app/gestao/reservas">
          Reservas
          <ArrowUpRight size={14} />
        </Link>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="filter-bar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Buscar registros"
            placeholder={`Buscar em ${resource.label.toLowerCase()}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <span className="subtle">{query.data?.data.length ?? 0} registros nesta página</span>
      </div>
      {editing !== undefined && (
        <ResourceForm
          key={type + (editing?.id ?? 'new')}
          resource={resource}
          row={editing}
          onClose={() => setEditing(undefined)}
          onSaved={async () => {
            setEditing(undefined);
            await client.invalidateQueries();
          }}
        />
      )}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data?.data.length ? (
        <Empty
          title={`Nenhum ${resource.singular} cadastrado`}
          description="Use o botão Adicionar para começar a organizar a operação."
        />
      ) : (
        <div className="table-scroll panel">
          <table>
            <thead>
              <tr>
                {resource.columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {query.data.data.map((row) => (
                <tr key={row.id}>
                  {resource.columns.map((c) => {
                    const value = readKey(row, c.key);
                    return (
                      <td key={c.key}>
                        {c.key === 'status' || c.key === 'role' ? (
                          <Status value={String(value)} />
                        ) : typeof value === 'boolean' ? (
                          value ? (
                            'Sim'
                          ) : (
                            'Não'
                          )
                        ) : c.key === 'scheduledDeparture' ? (
                          dateTime(String(value))
                        ) : (
                          String(value ?? '—')
                        )}
                      </td>
                    );
                  })}
                  <td>
                    <div className="button-row">
                      {type === 'trips' && (
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/app/viagens/${row.id}`} aria-label="Abrir viagem">
                            <ArrowUpRight size={17} />
                          </Link>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar ${resource.singular}`}
                        onClick={async () => {
                          if (type === 'routes') {
                            try {
                              const detail = await api<{
                                stops: { stopId: string; estimatedOffsetMinutes: number }[];
                              }>(`/routes/${row.id}`);
                              setEditing({ ...row, stops: detail.stops });
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          } else setEditing(row);
                        }}
                      >
                        <Pencil size={16} />
                      </Button>
                      {['vehicles', 'routes', 'stops'].includes(type) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Excluir ${resource.singular}`}
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Excluir este ${resource.singular}? Registros vinculados a viagens ou itinerários serão preservados.`,
                              )
                            )
                              return;
                            try {
                              await api(`${resource.endpoint}/${row.id}`, { method: 'DELETE' });
                              await client.invalidateQueries();
                            } catch (e) {
                              setError((e as Error).message);
                            }
                          }}
                        >
                          <Trash2 size={16} />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
function ResourceForm({
  resource,
  row,
  onClose,
  onSaved,
}: {
  resource: Resource;
  row: Row | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [error, setError] = useState(''),
    [saving, setSaving] = useState(false);
  const [chosen, setChosen] = useState<{ stopId: string; estimatedOffsetMinutes: number }[]>(
    Array.isArray(row?.stops) ? row.stops : [],
  );
  const sources = useQuery({
    queryKey: ['management-sources'],
    queryFn: async () => {
      const [routes, vehicles, users, stops] = await Promise.all([
        api<List<Row>>('/routes?limit=100'),
        api<List<Row>>('/vehicles?limit=100'),
        api<List<Row>>('/users?limit=100'),
        api<List<Row>>('/stops?limit=100'),
      ]);
      return {
        routes: routes.data,
        vehicles: vehicles.data,
        drivers: users.data.filter((u) => u.role === 'driver' && u.isActive),
        stops: stops.data,
      };
    },
  });
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const form = new FormData(e.currentTarget),
        body: Record<string, unknown> = {};
      for (const f of resource.fields) {
        if (f.type === 'stops') {
          body.stops = chosen.map((p, i) => ({
            ...p,
            kind: i === chosen.length - 1 ? 'alighting' : 'boarding',
          }));
          continue;
        }
        const raw = form.get(f.name);
        if (f.type === 'checkbox') body[f.name] = raw === 'on';
        else if (f.type === 'number') body[f.name] = Number(raw);
        else if (f.type === 'datetime-local') body[f.name] = new Date(String(raw)).toISOString();
        else if (f.name === 'password' && !raw) continue;
        else body[f.name] = raw || null;
      }
      if (row) await patch(`${resource.endpoint}/${row.id}`, body);
      else await post(resource.endpoint, body);
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="panel resource-form">
      <div className="section-heading">
        <h2>
          {row ? 'Editar' : 'Adicionar'} {resource.singular}
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar formulário">
          <X size={20} />
        </Button>
      </div>
      <form onSubmit={save}>
        <div className="form-grid">
          {resource.fields.map((f) => {
            const raw = row?.[f.name];
            if (f.type === 'stops')
              return (
                <div className="stop-editor" key={f.name}>
                  <label>
                    {f.label}
                    <select
                      aria-label="Adicionar ponto ao itinerário"
                      value=""
                      onChange={(e) => {
                        if (e.target.value && !chosen.some((p) => p.stopId === e.target.value))
                          setChosen([
                            ...chosen,
                            { stopId: e.target.value, estimatedOffsetMinutes: chosen.length * 30 },
                          ]);
                      }}
                    >
                      <option value="">Adicionar ponto…</option>
                      {sources.data?.stops.map((s) => (
                        <option value={s.id} key={s.id}>
                          {String(s.name)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <small>{f.hint}</small>
                  {chosen.map((p, i) => (
                    <div className="stop-edit-row" key={p.stopId}>
                      <strong>
                        {i + 1}.{' '}
                        {String(
                          sources.data?.stops.find((s) => s.id === p.stopId)?.name ?? 'Ponto',
                        )}
                      </strong>
                      <label>
                        Minutos desde a saída
                        <input
                          aria-label={`Minutos até o ponto ${i + 1}`}
                          type="number"
                          min={0}
                          value={p.estimatedOffsetMinutes}
                          onChange={(e) =>
                            setChosen(
                              chosen.map((x, k) =>
                                k === i
                                  ? { ...x, estimatedOffsetMinutes: Number(e.target.value) }
                                  : x,
                              ),
                            )
                          }
                        />
                      </label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={i === 0}
                        aria-label="Mover ponto para cima"
                        onClick={() => {
                          const c = [...chosen];
                          [c[i - 1], c[i]] = [c[i], c[i - 1]];
                          setChosen(c);
                        }}
                      >
                        <ArrowUp size={16} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={i === chosen.length - 1}
                        aria-label="Mover ponto para baixo"
                        onClick={() => {
                          const c = [...chosen];
                          [c[i + 1], c[i]] = [c[i], c[i + 1]];
                          setChosen(c);
                        }}
                      >
                        <ArrowDown size={16} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remover ponto"
                        onClick={() => setChosen(chosen.filter((_, k) => k !== i))}
                      >
                        <X size={16} />
                      </Button>
                    </div>
                  ))}
                </div>
              );
            if (f.type === 'checkbox')
              return (
                <label className="checkbox-label" key={f.name}>
                  <input
                    name={f.name}
                    type="checkbox"
                    defaultChecked={raw === undefined ? f.name === 'isActive' : !!raw}
                  />
                  {f.label}
                  {f.hint && <small>{f.hint}</small>}
                </label>
              );
            let value = raw == null ? '' : String(raw);
            if (f.type === 'datetime-local' && value) {
              const d = new Date(value);
              value = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16);
            }
            const rows = f.source
              ? sources.data?.[f.source as keyof NonNullable<typeof sources.data>]
              : undefined;
            return (
              <label key={f.name}>
                {f.label}
                {f.type === 'select' ? (
                  <select
                    name={f.name}
                    defaultValue={value || f.options?.[0]?.value || ''}
                    required
                  >
                    <option value="">Selecione…</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                    {rows?.map((r) => (
                      <option key={r.id} value={r.id}>
                        {String(r.name ?? r.internalCode ?? r.plate)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={f.name}
                    type={f.type ?? 'text'}
                    defaultValue={f.type === 'password' ? '' : value}
                    required={f.required !== false}
                    min={f.min}
                    max={f.max}
                    step={f.type === 'number' ? 'any' : undefined}
                    maxLength={f.type === 'password' ? 128 : 250}
                  />
                )}{' '}
                {f.hint && <small>{f.hint}</small>}
              </label>
            );
          })}
        </div>
        {sources.error && (
          <p className="field-error">Não foi possível carregar as opções dos cadastros.</p>
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={saving}>{saving ? 'Salvando…' : 'Salvar cadastro'}</Button>
        </div>
      </form>
    </section>
  );
}
