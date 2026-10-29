# Deploy

## Frontend

Preparado para Vercel como projeto Next.js, Root Directory `apps/web`, pnpm 11, Node.js 24. Instalação na raiz do workspace e build `pnpm --filter @vantrack/web build`. Configure `NEXT_PUBLIC_API_URL=https://api.seudominio.com`. Nenhuma credencial de banco no frontend. Fontes são empacotadas localmente.

## Backend

Use hospedagem Node.js persistente com suporte a WebSocket e HTTPS. Build na raiz: `pnpm --filter @vantrack/api build`. Início: `pnpm --filter @vantrack/api start`. O build inclui os pacotes compartilhados e corrige seus caminhos para executar JavaScript compilado.

Configure `NODE_ENV=production`, `DATABASE_URL` pooled, `DATABASE_URL_UNPOOLED` direta, `JWT_SECRET` aleatório forte, `WEB_ORIGIN` exata do frontend, SMTP e `SIMULATOR_ENABLED=false`. API e frontend devem usar subdomínios do mesmo domínio registrável para cookies SameSite=Lax. Não hospede cada um em sites sem relação; nesse caso use um proxy sob o mesmo domínio.

Aplique `pnpm db:migrate` uma vez como release task com URL direta. Não use o seed demo em produção. Crie o primeiro administrador com `pnpm admin:create` e variáveis privadas `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (mínimo 9 caracteres); o comando recusa duplicação e não altera usuários existentes. Remova essas variáveis após o comando.

Healthcheck `/health` verifica o banco. Cookies HttpOnly/Secure, CORS restritivo, validação de Origin nas mutações e handshake WS. Configure uma camada de proxy confiável com limitação por IP antes da API; a aplicação não confia automaticamente em X-Forwarded-For.

Inicialmente use uma instância. Para escalar horizontalmente, adicione adapter Socket.IO Redis, rate limiter distribuído e eleição de um worker de retenção/fila. O simulador é de desenvolvimento e não é distribuído. Avalie outbox transacional antes de exigir entrega garantida de eventos; eventos são emitidos depois de persistir, e clientes reconciliam por REST.

PWA pode ser instalada em navegadores compatíveis. O service worker armazena somente a página offline, sem cachear respostas autenticadas nem coordenadas. HTTPS é obrigatório para GPS e instalação fora de localhost. Web Push não está implementado por ser uma etapa futura do escopo.

Não houve publicação ou validação de hospedagem nesta execução.
