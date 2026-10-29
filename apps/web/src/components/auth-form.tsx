'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { BusFront, ArrowRight, ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { passwordSchema } from '@vantrack/shared';
import { post } from '@/lib/api';
import { Button } from './ui/button';
import { ThemeToggle } from './theme-toggle';
const schema = z.object({
  name: z.string().optional(),
  email: z.union([z.email('Informe um e-mail válido'), z.literal('')]),
  password: z.string().max(128).optional(),
});
type Values = z.infer<typeof schema>;
export function AuthForm({ mode }: { mode: 'login' | 'register' | 'forgot' | 'reset' }) {
  const router = useRouter(),
    params = useSearchParams(),
    client = useQueryClient();
  const [error, setError] = useState(''),
    [success, setSuccess] = useState(''),
    [show, setShow] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', name: '' },
  });
  const titles = {
    login: 'Seu caminho começa aqui.',
    register: 'Uma boa viagem começa com você.',
    forgot: 'Vamos recuperar seu acesso.',
    reset: 'Uma nova senha, um novo começo.',
  };
  const submit = handleSubmit(async (values) => {
    setError('');
    try {
      if (['register', 'reset'].includes(mode)) {
        const p = passwordSchema.safeParse(values.password);
        if (!p.success) throw new Error(p.error.issues[0].message);
      }
      if (mode === 'register' && (values.name?.trim().length ?? 0) < 2)
        throw new Error('Informe seu nome completo');
      if (mode !== 'reset' && !values.email) throw new Error('Informe seu e-mail');
      if (mode === 'forgot') {
        const r = await post<{ message: string }>('/auth/forgot-password', { email: values.email });
        setSuccess(r.message);
        return;
      }
      if (mode === 'reset') {
        await post('/auth/reset-password', {
          token: params.get('token'),
          password: values.password,
        });
        setSuccess('Senha alterada. Entre com sua nova senha.');
        return;
      }
      await post(
        `/auth/${mode === 'register' ? 'register' : 'login'}`,
        mode === 'register' ? values : { email: values.email, password: values.password },
      );
      client.clear();
      router.push('/app');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível continuar');
    }
  });
  return (
    <main className="auth-page" id="content">
      <section className="auth-intro">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <BusFront size={25} />
          </span>
          vantrack.
        </Link>
        <div>
          <span className="route-chip">Rio de Janeiro ↔ Teresópolis</span>
          <h1>
            Menos espera.
            <br />
            Mais caminho.
          </h1>
          <p>Da cidade à serra, acompanhe cada trecho e encontre tranquilidade na sua rotina.</p>
          <div className="journey-line">
            <span>Rio de Janeiro</span>
            <i />
            <BusFront size={24} />
            <i />
            <span>Teresópolis</span>
          </div>
        </div>
        <p className="auth-footnote">
          <ShieldCheck size={18} />
          Seu trajeto é privado. Sua viagem é compartilhada.
        </p>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-top">
          <Link href="/" className="back-link">
            <ArrowLeft size={16} />
            Voltar ao início
          </Link>
          <ThemeToggle />
        </div>
        <div className="auth-form-wrap">
          <p className="greeting">
            {mode === 'login'
              ? 'Bom ter você por aqui'
              : mode === 'register'
                ? 'Junte-se ao trajeto'
                : 'Conta VanTrack'}
          </p>
          <h2>{titles[mode]}</h2>
          <p className="subtle">
            {mode === 'login'
              ? 'Entre para acompanhar sua van e organizar suas viagens.'
              : mode === 'register'
                ? 'Crie sua conta de professor para reservar sua próxima vaga.'
                : 'Use o e-mail associado à sua conta.'}
          </p>
          {success ? (
            <div role="status" className="success-message">
              <ShieldCheck />
              <p>{success}</p>
              <Button asChild>
                <Link href="/login">Ir para o login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="form-stack" noValidate>
              {mode === 'register' && (
                <label>
                  Nome completo
                  <input autoComplete="name" {...register('name')} />
                </label>
              )}
              {mode !== 'reset' && (
                <label>
                  E-mail
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="voce@exemplo.com"
                    {...register('email')}
                  />
                  {errors.email && <span className="field-error">{errors.email.message}</span>}
                </label>
              )}
              {mode !== 'forgot' && (
                <label>
                  {mode === 'reset' ? 'Nova senha' : 'Senha'}
                  <span className="password-field">
                    <input
                      type={show ? 'text' : 'password'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      {...register('password')}
                    />
                    <button
                      type="button"
                      aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
                      onClick={() => setShow(!show)}
                    >
                      {show ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                  {mode !== 'login' && <small>Use pelo menos 9 caracteres.</small>}
                </label>
              )}
              {mode === 'login' && (
                <Link className="forgot-link" href="/recuperar-senha">
                  Esqueci minha senha
                </Link>
              )}
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" disabled={isSubmitting}>
                {isSubmitting
                  ? 'Aguarde…'
                  : mode === 'login'
                    ? 'Entrar na minha conta'
                    : mode === 'register'
                      ? 'Criar minha conta'
                      : mode === 'forgot'
                        ? 'Enviar instruções'
                        : 'Salvar nova senha'}
                <ArrowRight size={18} />
              </Button>
            </form>
          )}
          {mode === 'login' && (
            <p className="auth-switch">
              Primeira viagem? <Link href="/cadastro">Crie sua conta</Link>
            </p>
          )}
          {mode === 'register' && (
            <p className="auth-switch">
              Já faz parte? <Link href="/login">Entre na sua conta</Link>
            </p>
          )}
          <p className="privacy-note">
            Seus dados e sua localização ficam disponíveis apenas para participantes autorizados.
          </p>
        </div>
      </section>
    </main>
  );
}
