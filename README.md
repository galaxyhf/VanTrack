# VanTrack

Sistema web de transporte de professores no trajeto **Rio de Janeiro ↔ Teresópolis**. Monorepo com Next.js 16, React 19, NestJS, Drizzle e PostgreSQL Neon. Aplicação responsiva com mapa, reservas transacionais, comunicação Socket.IO e controle por perfil.

## Executar

Requisitos: Node.js 22.12+ (validado com 24), pnpm 11.

```sh
pnpm install
cp .env.example .env
openssl rand -base64 48
```

Preencha `JWT_SECRET` com o segredo gerado; escolha uma senha de desenvolvimento com pelo menos 9 caracteres em `DEMO_PASSWORD`; configure `DATABASE_URL` pooled e `DATABASE_URL_UNPOOLED` direta do seu banco Neon. O arquivo `.env` fica na raiz e é ignorado pelo Git. Nunca publique credenciais reais.

A aplicação usa exclusivamente o Neon; não há banco local nem seleção de modo de banco.

```sh
pnpm db:migrate
pnpm db:check
pnpm db:seed
pnpm dev
```

- Web: [localhost:3000](http://localhost:3000)
- API: [localhost:4000/health](http://localhost:4000/health)
- Swagger: [localhost:4000/docs](http://localhost:4000/docs)

O seed é idempotente e recusa produção. Contas: `admin@vantrack.demo`, `motorista@vantrack.demo`, `motorista2@vantrack.demo`, `professor@vantrack.demo` e `professor2@vantrack.demo` até `professor10@vantrack.demo`. Todas usam o valor local de `DEMO_PASSWORD`. O cadastro público cria apenas professores.

**Com Neon:** o driver oficial usa WebSocket sobre HTTPS e suporta transações interativas. `pnpm db:check` verifica conexão, acesso à tabela de usuários e uma transação pelo mesmo adapter da API. Em caso de falha, confira as URLs, a migração e o acesso de rede ao endpoint Neon.

## Variáveis de ambiente

O `.env` básico tem seis variáveis:

| Variável                | Finalidade                                             |
| ----------------------- | ------------------------------------------------------ |
| `DATABASE_URL`          | Conexão pooled com o Neon usada pela API.              |
| `DATABASE_URL_UNPOOLED` | Conexão direta com o mesmo banco, usada nas migrações. |
| `JWT_SECRET`            | Segredo para assinar e validar as sessões.             |
| `SEED_DEMO`             | Autoriza o comando que cria dados demonstrativos.      |
| `DEMO_PASSWORD`         | Senha das contas criadas pelo seed.                    |
| `SIMULATOR_ENABLED`     | Habilita o simulador das viagens demonstrativas.       |

As três últimas são opcionais fora da demonstração. Portas e endereços de desenvolvimento já têm padrão no código: API 4000 e web 3000. Só configure `PORT`, `WEB_ORIGIN` e `NEXT_PUBLIC_API_URL` se mudar esses endereços. `ROUTING_URL` tem padrão OSRM. E-mail é opcional: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` e `MAIL_FROM` só são necessários ao configurar entrega de e-mail. Em hospedagem, configure também `NODE_ENV=production`; veja o guia de deploy.

## Estrutura

```text
apps/web             Next.js, interface e PWA
apps/api             NestJS, REST, Socket.IO, tarefas agendadas
packages/database    schema Drizzle, migrações e seeds
packages/shared      contratos Zod e regras compartilhadas
packages/config      TypeScript strict
scripts              ferramentas de build
```

Serviços separados de controllers: autenticação, operação, reservas, rastreamento, roteamento/ETA, simulador, comunicação e administração. Detalhes e diagrama em [Arquitetura](docs/architecture.md).

## Fluxo de demonstração

1. Entre como administrador e abra Gestão. Cadastre ou reutilize veículos, motoristas, pontos e rotas.
2. Programe uma viagem marcada como demonstração. Evite veículo ou motorista que já esteja em uma viagem em andamento.
3. Entre como professor em outro perfil do navegador. Abra Viagens, escolha um ponto e confirme a reserva.
4. Entre como motorista. Abra a viagem, abra o embarque e inicie.
5. Na viagem demonstrativa, use os controles do simulador. Na viagem real, autorize o compartilhamento GPS.
6. Envie um aviso ou atraso. O professor acompanha o mapa, as mensagens e as notificações.
7. Confirme embarques/desembarques e encerre. Consulte Histórico e Relatórios.

Há também uma viagem demonstrativa em andamento no seed. Sua posição inicial é identificada como antiga; inicie o simulador para atualizá-la.

## Qualidade

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
node scripts/smoke-api-build.mjs
pnpm exec playwright install chromium
pnpm test:e2e
pnpm format:check
```

Os testes de integração usam PostgreSQL em memória exclusivamente para testes. Os E2E usam uma branch Neon exclusiva com `TEST_DATABASE_URL` e `TEST_DATABASE_URL_UNPOOLED`, portas 3100/4100 e `.next-e2e`. A evidência de validação e os limites estão em [Validação](docs/validation.md).

## Documentação

- [Requisitos originais](docs/requirements.md)
- [Arquitetura e entidades](docs/architecture.md)
- [Regras de negócio](docs/business-rules.md)
- [REST e eventos](docs/api.md)
- [Simulador e GPS](docs/tracking.md)
- [Testes](docs/testing.md)
- [Deploy](docs/deploy.md)

Localização exige permissão, HTTPS e viagem em andamento. Navegadores não garantem GPS em segundo plano ou com tela bloqueada. ETA não inclui trânsito em tempo real. Pontos de seed são fictícios e explicitamente identificados. Web Push e app nativo estão fora desta versão.
