# API REST e eventos

Swagger executável: `/docs`; documento JSON: `/docs-json`. Schemas de corpo derivados dos mesmos contratos Zod usados no backend e frontend. Erros têm `{error:{message,issues?},statusCode}`. Listas retornam `{data,page,limit?}`. Detalhes e mutações retornam o recurso/resultado. Datas ISO 8601 em UTC; interface usa America/Sao_Paulo.

Autenticação: cookies `vt_access` (15 minutos, HttpOnly) e `vt_refresh` (7 dias, HttpOnly, path `/auth`). Produção usa Secure. Envie `credentials: include` no navegador e `Origin` exatamente igual a `WEB_ORIGIN` em toda mutação. Nenhum token é devolvido em JSON ou armazenado em localStorage. Swagger pode operar na sessão, mas mutações feitas fora da origem do frontend exigem cliente autorizado com Origin configurada.

| Domínio      | Operações                                                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth         | POST register, login, refresh, logout, forgot-password, reset-password, password; GET me, sessions; PATCH profile; DELETE sessions/:id, sob `/auth` |
| Veículos     | GET/POST `/vehicles`, GET/PATCH/DELETE `/vehicles/:id`                                                                                              |
| Pontos       | GET/POST `/stops`, PATCH `/stops/:id`                                                                                                               |
| Rotas        | GET/POST `/routes`, GET/PATCH `/routes/:id`                                                                                                         |
| Viagens      | GET/POST `/trips`, GET/PATCH `/trips/:id`; POST boarding, start, finish, cancel, delay, incidents sob `/trips/:id`                                  |
| Reservas     | GET `/reservations/me`; POST `/reservations`, `/reservations/:id/cancel`, `/reservations/:id/attendance`                                            |
| Fila         | POST `/waitlist`, `/waitlist/:id/accept`, `/waitlist/:id/leave`                                                                                     |
| Tracking     | GET `/trips/:id/location`, location-history, eta, geometry; POST location, tracking-consent, simulator                                              |
| Chat         | GET/POST `/trips/:id/messages`; POST `/trips/:id/messages/read`; GET `/messages/unread`                                                             |
| Notificações | GET `/notifications`; PATCH `/notifications/:id/read`                                                                                               |
| Admin        | GET/POST `/users`, PATCH `/users/:id`; GET `/admin/dashboard`, live, reports, reports.csv, audit, reservations, settings; PATCH `/admin/settings`   |

Paginação: `page` ≥1, `limit` 1–100. Viagens aceitam `search`, `from`, `to`, `vehicleId`, `routeId`, `driverId` e `participantsOnly=true`. Relatórios aceitam os mesmos filtros de data/entidades e limitam exportação a 1.000 linhas; gráficos exibem até 31 dias com dados. Usuários/veículos aceitam busca. Ordenação é determinística por domínio: viagens por saída decrescente, mensagens/notificações por criação, pontos/rotas por nome, frota por identificação.

## Socket.IO

Transporte WebSocket na mesma API. Handshake exige Origin permitida e cookie access válido. Cada comando revalida sessão e autorização. Até 100 comandos por socket por minuto; payload máximo 8 KB. Conexões são renovadas periodicamente; cliente renova a sessão antes de reconectar quando necessário.

| Direção                    | Evento                                                             | Corpo                                                                                       |
| -------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Cliente → servidor         | `trip:join`                                                        | `{tripId}`; ack `{ok:true}` após autorização                                                |
| Cliente → servidor         | `vehicle:location`                                                 | `{tripId,latitude,longitude,accuracy,speed,heading,recordedAt}`; ack `{accepted,location?}` |
| Cliente → servidor         | `trip:message`                                                     | `{tripId,content,operational}`                                                              |
| Servidor → sala da viagem  | `vehicle:location`                                                 | Localização persistida, com `isSimulated`                                                   |
| Servidor → sala da viagem  | `vehicle:offline`                                                  | `{tripId}`; manter última posição com aviso                                                 |
| Servidor → sala da viagem  | `trip:eta_updated`                                                 | Estimativa, fonte, timestamp e estado desatualizado                                         |
| Servidor → sala da viagem  | `trip:started`, `trip:finished`, `trip:boarding`, `trip:cancelled` | Viagem atualizada                                                                           |
| Servidor → sala da viagem  | `reservation:created`, `reservation:cancelled`                     | Sinal de reconciliação por REST; sem dados pessoais                                         |
| Servidor → sala da viagem  | `trip:message`                                                     | Mensagem persistida com remetente e horário                                                 |
| Servidor → sala da viagem  | `trip:delay`                                                       | `{minutes,description}`                                                                     |
| Servidor → sala do usuário | `notification:new`                                                 | Notificação ou sinal de reconciliação                                                       |
| Servidor → cliente         | `exception`                                                        | Comando recusado, sem dados privados                                                        |

Salas: `trip:<id>` e salas privadas por usuário/sessão. Não há inscrições públicas de localização. Cancelar reserva remove o usuário da sala. Logout e revogação encerram sockets da sessão. Clientes recuperam estado por REST após reconexão; WebSocket não substitui persistência.
