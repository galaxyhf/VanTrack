# Evidência de validação

Data: 28/10/2026. Ambiente: macOS, Node.js 24, pnpm 11, Chromium/Playwright. Validação local com PostgreSQL embarcado; não representa validação Neon nem deploy.

| Verificação                      | Resultado                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------- |
| Instalação pelo lockfile         | Passou; scripts nativos autorizados, Scarf bloqueado                              |
| Schema e migração Drizzle        | 17 tabelas; migração aplicada; geração posterior sem diferenças                   |
| Seed persistido                  | 1 administrador, 2 motoristas, 10 professores, 3 veículos, 2 rotas e viagens demo |
| ESLint                           | Passou                                                                            |
| TypeScript strict                | Passou nos pacotes e nas duas aplicações                                          |
| Prettier                         | Passou                                                                            |
| Unitários e integração           | 11 testes passaram                                                                |
| E2E Chromium                     | 5 fluxos passaram                                                                 |
| Build Next.js                    | Passou; 20 páginas geradas/registradas                                            |
| Build NestJS                     | Passou                                                                            |
| Execução do JavaScript compilado | Healthcheck e contrato Swagger de 54 caminhos passaram                            |
| Layout                           | Sem overflow horizontal em 390 e 1440 px                                          |
| OpenStreetMap                    | Tiles carregados na revisão visual, sem falhas de requisição observadas           |
| Temas                            | Capturas claro/escuro/mobile em `docs/screenshots`                                |

## Fluxos verificados

1. Cadastro público, reserva por ponto, bloqueio de acesso administrativo e sala WS privada, início pelo motorista, localização simulada por serviço real, chat nas duas direções, atraso/notificação, embarque, desembarque e encerramento; indicadores atualizados.
2. Rotação de refresh, cookie com caminho restrito, revogação no logout e bloqueio de mutação sem Origin autorizada.
3. Landing/login/dashboard em 390 e 1440 px, proteção da área autenticada e mapa montado.
4. Geolocation API com permissão e coordenadas controladas no Chromium: localização persistida como não simulada, pausa e rejeição de envio após revogar consentimento. Não foi teste físico de GPS.
5. Recuperação de senha com token temporário, uso único e revogação da sessão anterior. Entrega de desenvolvimento por arquivo privado, sem SMTP externo.

Testes de integração também verificam disputa pela última vaga, reserva duplicada, ponto inválido, lista de espera FIFO, reserva de capacidade durante oferta, confirmação, expiração, transições inválidas e conflito de agenda.

## Contraste medido no navegador

| Par                                       |   Claro |  Escuro |
| ----------------------------------------- | ------: | ------: |
| Texto principal / fundo                   | 17,06:1 | 18,10:1 |
| Texto secundário / superfície             |  6,82:1 |  6,91:1 |
| Navegação selecionada / fundo selecionado |  4,51:1 |  8,42:1 |

Medição dos tokens principais; não equivale a uma auditoria WCAG integral. Controles do motorista têm 56 px; botões gerais e zoom do mapa, 44 px. Movimento reduzido é respeitado.

## Limites e pendências externas

- Neon: projeto VanTrack identificado e branch `vantrack-development` criada. A migração externa não foi confirmada devido à rede. As credenciais ficam somente no `.env` ignorado. Conforme solicitado, o restante foi concluído sem insistir nessa conexão.
- GPS físico, Safari/iOS/Android, instalação PWA em aparelho e rastreamento sob bloqueio da tela não foram verificados. Navegadores não garantem execução em segundo plano.
- SMTP externo e hospedagem Vercel/Node não foram publicados nem validados. O projeto inclui configuração e instruções.
- ETA usa roteamento/estimativa; não contém trânsito real. O provedor público OSRM não tem SLA de produção.
- Web Push permanece futuro, conforme escopo. App nativo não faz parte desta versão.
- API preparada inicialmente para uma instância; escala horizontal exige adapter Socket.IO, rate limiter e worker distribuídos, conforme o guia de deploy.
