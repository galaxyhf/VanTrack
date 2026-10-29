# Testes

`pnpm test` executa regras compartilhadas e serviços reais contra PGlite em memória, aplicando a migração Drizzle. Abrange capacidade com ofertas, reserva concorrente na última vaga, duplicação, autorização, fila FIFO, expiração, confirmação da oferta, transições e conflitos de agenda.

`pnpm test:e2e` inicia API e Next em portas exclusivas 4100 e 3100, migra e inicializa `.data/e2e`. O Chromium executa cadastro/login, reserva, bloqueio RBAC e de sala WS, início de viagem, GPS simulado, chat em ambas as direções, notificações, embarque, desembarque e encerramento. Verifica rotação de refresh, revogação, origem de mutações, recuperação com token único, GPS do navegador com coordenadas controladas, pausa e layouts 390/1440 px. Usa dados reais persistidos no PostgreSQL embarcado. Não prova conexão Neon nem GPS físico.

Instale o navegador com `pnpm exec playwright install chromium`. Traces e screenshots de falhas ficam em `test-results`; relatório em `playwright-report`. `pnpm exec playwright show-report` abre o relatório.

Não execute dois processos sobre o mesmo diretório PGlite. A suíte cria usuários/viagens com identificadores únicos e não remove dados do ambiente de desenvolvimento. Para validar Neon, use uma branch exclusiva com `DATABASE_MODE=neon`, aplique a migração e execute o fluxo com credenciais privadas.

`node scripts/smoke-api-build.mjs` valida o JavaScript compilado com banco temporário e healthcheck/Swagger; execute depois do build. `node scripts/review-ui.mjs` exige a aplicação local iniciada, salva screenshots e mede os contrastes principais nos temas claro e escuro.
