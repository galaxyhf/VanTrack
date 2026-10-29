# VanTrack

Sistema web de transporte de professores no trajeto **Rio de Janeiro ↔ Teresópolis**. Monorepo com Next.js 16, React 19, NestJS, Drizzle e PostgreSQL Neon. Aplicação responsiva com mapa, reservas transacionais, comunicação Socket.IO e controle por perfil.

## Executar

Requisitos: Node.js 22.12+ (validado com 24), pnpm 11.

```sh
pnpm install
cp .env.example .env
openssl rand -base64 48
```

Preencha `JWT_SECRET` com o segredo gerado; escolha uma senha de desenvolvimento com pelo menos 9 caracteres em `DEMO_PASSWORD`; ajuste `DATABASE_DATA_DIR` para um caminho absoluto dentro deste projeto. O arquivo `.env` fica na raiz e é ignorado pelo Git. Nunca publique credenciais reais.

**Desenvolvimento sem acesso ao Neon:** mantenha `DATABASE_MODE=embedded`. PGlite executa PostgreSQL em WebAssembly com persistência em disco; os dados não são mocks. Use apenas um processo da API por diretório de dados. Esse modo é bloqueado em produção.

```sh
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Web: [localhost:3000](http://localhost:3000)
- API: [localhost:4000/health](http://localhost:4000/health)
- Swagger: [localhost:4000/docs](http://localhost:4000/docs)

O seed é idempotente e recusa produção. Contas: `admin@vantrack.demo`, `motorista@vantrack.demo`, `motorista2@vantrack.demo`, `professor@vantrack.demo` e `professor2@vantrack.demo` até `professor10@vantrack.demo`. Todas usam o valor local de `DEMO_PASSWORD`. O cadastro público cria apenas professores.

**Com Neon:** configure as URLs pooled e direta, selecione `DATABASE_MODE=neon`, execute a mesma migração. O driver oficial Neon usa WebSocket sobre HTTPS e suporta transações interativas. A rede atual bloqueia o Neon; a validação externa está pendente. Não há troca automática silenciosa para dados locais.

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

Os testes de integração usam PostgreSQL embarcado em memória. Os E2E usam portas exclusivas 3100/4100, `.data/e2e` e `.next-e2e`, sem acessar Neon. A evidência de validação e os limites estão em [Validação](docs/validation.md).

## Documentação

- [Requisitos originais](docs/requirements.md)
- [Arquitetura e entidades](docs/architecture.md)
- [Regras de negócio](docs/business-rules.md)
- [REST e eventos](docs/api.md)
- [Simulador e GPS](docs/tracking.md)
- [Testes](docs/testing.md)
- [Deploy](docs/deploy.md)

Localização exige permissão, HTTPS e viagem em andamento. Navegadores não garantem GPS em segundo plano ou com tela bloqueada. ETA não inclui trânsito em tempo real. Pontos de seed são fictícios e explicitamente identificados. Web Push e app nativo estão fora desta versão.
