'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BusFront,
  LayoutDashboard,
  Map,
  Ticket,
  MessageSquare,
  Bell,
  Settings2,
  History,
  UserRound,
  ArrowUpRight,
  LogOut,
  ChartNoAxesCombined,
  ShieldCheck,
} from 'lucide-react';
import { connectRealtime } from '@/lib/realtime';
import { api, ApiError, post } from '@/lib/api';
import type { User, List, Notification } from '@/lib/types';
import { Loading, ErrorState, Empty } from './states';
import { Button } from './ui/button';
import { ThemeToggle } from './theme-toggle';
const base = [
  { href: '/app', label: 'Início', icon: Map },
  { href: '/app/reservas', label: 'Reservas', icon: Ticket },
  { href: '/app/mensagens', label: 'Mensagens', icon: MessageSquare },
  { href: '/app/perfil', label: 'Perfil', icon: UserRound },
];
export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter(),
    pathname = usePathname(),
    client = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<User>('/auth/me'), retry: false });
  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<List<Notification>>('/notifications?limit=100'),
    enabled: !!me.data,
    refetchInterval: 30000,
  });
  const unreadMessages = useQuery({
    queryKey: ['unread-messages'],
    queryFn: () => api<{ data: { trip_id: string; count: number }[] }>('/messages/unread'),
    enabled: !!me.data,
    refetchInterval: 30000,
  });
  const messageCount = unreadMessages.data?.data.reduce((n, r) => n + r.count, 0) ?? 0;
  useEffect(() => {
    if (me.error instanceof ApiError && me.error.status === 401) router.replace('/login');
  }, [me.error, router]);
  const userId = me.data?.id;
  useEffect(() => {
    if (!userId) return;
    const s = connectRealtime();
    s.on('notification:new', () => {
      void client.invalidateQueries({ queryKey: ['notifications'] });
      void client.invalidateQueries({ queryKey: ['unread-messages'] });
    });
    return () => {
      s.disconnect();
    };
  }, [userId, client]);
  if (me.isPending) return <Loading />;
  if (me.error) return <ErrorState error={me.error} retry={() => void me.refetch()} />;
  if (!me.data) return null;
  const user = me.data;
  const admin = user.role === 'admin';
  const links = admin
    ? [
        { href: '/app', label: 'Visão geral', icon: LayoutDashboard },
        { href: '/app/monitoramento', label: 'Monitoramento', icon: Map },
        { href: '/app/gestao', label: 'Gestão operacional', icon: Settings2 },
        { href: '/app/mensagens', label: 'Mensagens', icon: MessageSquare },
        { href: '/app/relatorios', label: 'Relatórios', icon: ChartNoAxesCombined },
        { href: '/app/historico', label: 'Histórico', icon: History },
        { href: '/app/configuracoes', label: 'Configurações', icon: ShieldCheck },
      ]
    : [
        ...base
          .slice(0, 3)
          .map((l) =>
            user.role === 'driver' && l.href === '/app/reservas'
              ? { ...l, label: 'Minhas viagens', href: '/app/viagens' }
              : l,
          ),
        { href: '/app/historico', label: 'Histórico', icon: History },
      ];
  const active = (href: string) =>
    pathname === href || (href !== '/app' && pathname.startsWith(href));
  const unread = notifications.data?.data.filter((n) => !n.isRead).length ?? 0;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/app" className="brand">
          <span className="brand-mark">
            <BusFront size={23} />
          </span>
          vantrack<span className="brand-dot">.</span>
        </Link>
        <div className="workspace-label">
          Rio ↔ Teresópolis<small>Transporte de professores</small>
        </div>
        <nav aria-label="Navegação principal">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={active(l.href) ? 'nav-link active' : 'nav-link'}
            >
              <l.icon size={19} />
              {l.label}
              {l.href === '/app/mensagens' && messageCount > 0 && (
                <span className="nav-unread">{messageCount}</span>
              )}
              {l.href === '/app/monitoramento' && <span className="nav-live" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p className="network-caption">
            <ShieldCheck size={15} />
            Seu trajeto, conectado.
          </p>
          <Link href="/app/perfil" className="user-card">
            <span className="avatar">{user.name.charAt(0)}</span>
            <span>
              <strong>{user.name.split(' · ')[0]}</strong>
              <small>
                {admin ? 'Administrador' : user.role === 'driver' ? 'Motorista' : 'Professor'}
              </small>
            </span>
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="mobile-brand">
            <BusFront size={23} />
            <strong>vantrack.</strong>
          </div>
          <span className="desktop-crumb">
            Operação <span>/</span> Rio de Janeiro ↔ Teresópolis
          </span>
          <div className="top-actions">
            <span className="region">
              <span className="live-dot" />
              Horário de Brasília
            </span>
            <ThemeToggle />
            <Link
              href="/app/notificacoes"
              className="icon-link"
              aria-label={`Notificações: ${unread} não lidas`}
            >
              <Bell size={20} />
              {unread > 0 && <span className="notification-count">{unread}</span>}
            </Link>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sair"
              onClick={async () => {
                await post('/auth/logout');
                router.push('/login');
              }}
            >
              <LogOut size={18} />
            </Button>
          </div>
        </header>
        <main className="main-content">
          {user.role !== 'admin' &&
          ['/app/gestao', '/app/relatorios', '/app/configuracoes', '/app/monitoramento'].some((p) =>
            pathname.startsWith(p),
          ) ? (
            <Empty
              title="Acesso reservado à administração"
              description="Seu perfil permite acompanhar suas viagens. Cadastros e relatórios exigem um administrador."
            />
          ) : (
            children
          )}
        </main>
        <footer className="app-footer">
          VanTrack <span>Uma viagem mais tranquila começa aqui.</span>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Navegação móvel">
        {(admin
          ? [
              { href: '/app', label: 'Início', icon: LayoutDashboard },
              { href: '/app/monitoramento', label: 'Mapa', icon: Map },
              { href: '/app/gestao', label: 'Gestão', icon: Settings2 },
              { href: '/app/perfil', label: 'Perfil', icon: UserRound },
            ]
          : base.map((l) =>
              user.role === 'driver' && l.href === '/app/reservas'
                ? { ...l, href: '/app/viagens', label: 'Viagens' }
                : l,
            )
        ).map((l) => (
          <Link key={l.href} href={l.href} className={active(l.href) ? 'active' : ''}>
            <l.icon size={21} />
            <span>
              {l.label}
              {l.href === '/app/mensagens' && messageCount > 0 ? ` (${messageCount})` : ''}
            </span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
