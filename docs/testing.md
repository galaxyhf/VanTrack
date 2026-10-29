# Testes

`pnpm test` executa regras compartilhadas e serviços reais contra PGlite em memória, aplicando a migração Drizzle. Abrange capacidade com ofertas, reserva concorrente na última vaga, duplicação, autorização, fila FIFO, expiração, confirmação da oferta, transições e conflitos de agenda.

`pnpm test:e2e` inicia API e Next em portas exclusivas 4100 e 3100, migra e inicializa uma branch Neon exclusiva. O Chromium executa cadastro/login, reserva, bloqueio RBAC e de sala WS, início de viagem, GPS simulado, chat em ambas as direções, notificações, embarque, desembarque e encerramento. Verifica rotação de refresh, revogação, origem de mutações, recuperação com token único, GPS do navegador com coordenadas controladas, pausa e layouts 390/1440 px. Usa dados persistidos no Neon. Não prova GPS físico.

Instale o navegador com `pnpm exec playwright install chromium`. Traces e screenshots de falhas ficam em `test-results`; relatório em `playwright-report`. `pnpm exec playwright show-report` abre o relatório.

Para E2E, configure `TEST_DATABASE_URL` e `TEST_DATABASE_URL_UNPOOLED` no ambiente do comando, apontando para uma branch Neon descartável exclusiva para testes. A configuração recusa URLs do banco da aplicação e URLs de teste que apontem para bancos diferentes. O seed e os fluxos E2E alteram os dados dessa branch. Os testes de integração em memória continuam sem rede e não criam arquivos de banco. Na CI, cadastre as duas URLs como secrets de mesmo nome para habilitar as etapas Neon/E2E.

`node scripts/smoke-api-build.mjs` valida o JavaScript compilado com o Neon configurado e healthcheck/Swagger; execute depois do build. `node scripts/review-ui.mjs` exige a aplicação local iniciada, salva screenshots e mede os contrastes principais nos temas claro e escuro.
