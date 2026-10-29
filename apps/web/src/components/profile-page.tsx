'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { ShieldCheck, UserRound, Monitor, LogOut } from 'lucide-react';
import { api, post, patch } from '@/lib/api';
import type { User } from '@/lib/types';
import { dateTime } from '@/lib/utils';
import { Loading, ErrorState, Feedback } from './states';
import { Button } from './ui/button';
export function ProfilePage() {
  const client = useQueryClient(),
    router = useRouter();
  const [message, setMessage] = useState(''),
    [pending, setPending] = useState(false);
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<User>('/auth/me') });
  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api<{ id: string; createdAt: string; expiresAt: string }[]>('/auth/sessions'),
  });
  async function run(task: () => Promise<unknown>, success: string) {
    setPending(true);
    try {
      await task();
      await client.invalidateQueries();
      setMessage(success);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  if (me.isPending) return <Loading />;
  if (me.error) return <ErrorState error={me.error} />;
  const u = me.data;
  return (
    <div id="content">
      <div className="page-heading">
        <div>
          <p className="greeting">Seu espaço</p>
          <h1>Perfil e segurança</h1>
          <p>Mantenha suas informações e acessos em dia.</p>
        </div>
      </div>
      <Feedback message={message} />
      <div className="profile-grid">
        <section className="panel">
          <h2>
            <UserRound size={20} />
            Seus dados
          </h2>
          <form
            className="form-stack"
            key={u.id + u.name}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(
                () =>
                  patch('/auth/profile', { name: f.get('name'), phone: f.get('phone') || null }),
                'Perfil atualizado.',
              );
            }}
          >
            <label>
              Nome completo
              <input name="name" minLength={2} maxLength={100} defaultValue={u.name} required />
            </label>
            <label>
              E-mail
              <input type="email" value={u.email} readOnly />
              <small>
                Identificador da conta. Alterações de acesso são gerenciadas pela administração.
              </small>
            </label>
            <label>
              Telefone
              <input name="phone" type="tel" maxLength={25} defaultValue={u.phone ?? ''} />
            </label>
            <Button disabled={pending}>Salvar alterações</Button>
          </form>
        </section>
        <section className="panel">
          <h2>
            <ShieldCheck size={20} />
            Alterar senha
          </h2>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                await post('/auth/password', {
                  currentPassword: f.get('current'),
                  password: f.get('password'),
                });
                await post('/auth/logout');
                router.push('/login');
              }, 'Senha alterada. Entre novamente.');
            }}
          >
            <label>
              Senha atual
              <input type="password" name="current" autoComplete="current-password" required />
            </label>
            <label>
              Nova senha
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                minLength={9}
                maxLength={128}
                required
              />
              <small>Pelo menos 9 caracteres. As sessões serão encerradas.</small>
            </label>
            <Button variant="outline" disabled={pending}>
              Alterar senha
            </Button>
          </form>
        </section>
        <section className="panel">
          <h2>
            <Monitor size={20} />
            Sessões ativas
          </h2>
          <p className="subtle">Encerre acessos que você não reconhece.</p>
          {sessions.data?.map((s) => (
            <div className="session-row" key={s.id}>
              <div>
                <strong>Iniciada em {dateTime(s.createdAt)}</strong>
                <small>Expira em {dateTime(s.expiresAt)}</small>
              </div>
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  void run(
                    () => api(`/auth/sessions/${s.id}`, { method: 'DELETE' }),
                    'Sessão encerrada.',
                  )
                }
              >
                <LogOut size={16} />
                Encerrar
              </Button>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
