# PROJETO: VANTRACK — Sistema Inteligente de Monitoramento e Gestão de Transporte

## 1. Objetivo

Desenvolva uma aplicação web full stack, moderna, responsiva e funcional, chamada **VanTrack**, destinada ao gerenciamento e monitoramento em tempo real de vans utilizadas no transporte de professores.

O sistema será inicialmente utilizado como projeto pessoal e de portfólio, mas deverá possuir uma arquitetura escalável, organizada e preparada para expansão.

O cenário principal será o transporte de professores no trajeto **Rio de Janeiro ↔ Teresópolis, RJ**.

**Escopo atual: apenas web.** A aplicação deve funcionar em navegadores de desktop e de celular (mobile-first, responsiva). Aplicativo móvel nativo está fora do escopo desta versão.

O sistema deve permitir:

- Monitorar a localização da VAN em tempo real.
- Consultar horários de partida e chegada.
- Visualizar itinerários e pontos de embarque.
- Reservar e cancelar vagas.
- Gerenciar capacidade e ocupação dos veículos.
- Trocar mensagens entre professores e motoristas.
- Receber notificações sobre atrasos e alterações.
- Calcular estimativas de chegada (ETA).
- Consultar histórico de viagens.
- Administrar veículos, usuários, motoristas e itinerários.

**IMPORTANTE:** Não desenvolver apenas um protótipo visual. O objetivo é implementar um sistema completo, com frontend, backend, banco de dados, autenticação, regras de negócio, APIs, comunicação em tempo real e testes.

---

## 2. Tecnologias obrigatórias

### Frontend
- Next.js 16 com App Router.
- React 19.
- TypeScript em modo strict.
- Tailwind CSS 4.
- shadcn/ui.
- Lucide React.
- TanStack Query.
- React Hook Form + Zod.
- Leaflet + OpenStreetMap.
- Recharts para gráficos.
- Socket.IO Client.
- PWA com suporte à instalação.

### Backend
- NestJS com TypeScript.
- API REST.
- Socket.IO para WebSockets.
- JWT com Access Token e Refresh Token.
- Argon2 para hashing de senhas.
- Swagger/OpenAPI.
- Validação de DTOs.
- Controle de acesso baseado em papéis (RBAC).
- Rate limiting nas rotas sensíveis.

### Banco de dados
- PostgreSQL hospedado no Neon.
- Drizzle ORM.
- Migrações versionadas.
- Relacionamentos e índices.
- Transações para operações críticas.
- Seeds para ambiente de desenvolvimento.

### Infraestrutura
- Monorepo com pnpm Workspaces.
- Variáveis de ambiente separadas.
- ESLint e Prettier.
- GitHub Actions para CI.
- Frontend preparado para Vercel.
- Backend preparado para hospedagem Node.js com WebSockets persistentes.

Não utilizar Firebase ou Supabase como backend principal.

---

## 3. Arquitetura

Organize o projeto em um monorepo:

```text
vantrack/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── database/
│   ├── shared/
│   └── config/
├── docs/
├── .github/
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

Utilize arquitetura modular no NestJS, separando controllers, services, repositories, DTOs, gateways e regras de negócio.

Mantenha os contratos compartilhados entre frontend e backend.

Evite código duplicado, arquivos excessivamente grandes e lógica de negócio dentro dos componentes React.

---

## 4. Perfis de usuário

Implemente três perfis com permissões específicas.

### 4.1 Administrador

Pode:

- Gerenciar usuários e permissões.
- Cadastrar motoristas.
- Cadastrar veículos.
- Criar e editar rotas.
- Configurar horários.
- Gerenciar pontos de embarque.
- Acompanhar todas as viagens.
- Consultar reservas.
- Visualizar relatórios.
- Gerenciar avisos e ocorrências.
- Consultar logs administrativos.

### 4.2 Motorista

Pode:

- Consultar suas viagens.
- Iniciar e encerrar viagens.
- Compartilhar localização em tempo real.
- Visualizar passageiros confirmados.
- Confirmar embarque e desembarque.
- Informar atrasos.
- Enviar mensagens.
- Registrar ocorrências.
- Consultar seu histórico.

### 4.3 Professor

Pode:

- Consultar viagens disponíveis.
- Visualizar horários e itinerários.
- Reservar vagas.
- Cancelar reservas.
- Acompanhar localização da VAN.
- Consultar previsão de chegada.
- Receber notificações.
- Enviar mensagens ao motorista.
- Consultar histórico de viagens.
- Gerenciar seu perfil.

Implemente proteção de rotas no frontend e autorização real no backend.

---

## 5. Autenticação

Crie um sistema completo de autenticação.

Funcionalidades:

- Cadastro de usuários.
- Login com e-mail e senha.
- Logout.
- Renovação de sessão.
- Recuperação de senha por token temporário.
- Edição de perfil.
- Alteração de senha.
- Controle de sessões.
- Redirecionamento conforme perfil.

Armazene refresh tokens de maneira segura, utilizando hash no banco e cookies HttpOnly quando aplicável.

Não armazenar tokens sensíveis em localStorage.

O primeiro administrador deverá ser criado por seed ou comando seguro, nunca por cadastro público com escolha livre de papel.

---

## 6. Dashboard do administrador

Desenvolva um painel administrativo profissional.

### Indicadores

Exibir:

- Total de veículos cadastrados.
- Veículos em operação.
- Viagens programadas.
- Viagens em andamento.
- Viagens concluídas.
- Professores cadastrados.
- Reservas confirmadas.
- Ocupação média.
- Viagens atrasadas.

### Visualizações

Implementar:

- Cards com indicadores.
- Gráfico de viagens por período.
- Gráfico de ocupação.
- Histórico de atrasos.
- Lista de viagens recentes.
- Mapa com veículos ativos.
- Alertas operacionais.

Os dados devem vir do backend, não de valores fixos.

---

## 7. Monitoramento em tempo real

Este será um dos módulos mais importantes.

### Localização do motorista

Ao iniciar uma viagem, o motorista poderá ativar o compartilhamento de localização pelo navegador do celular.

Utilizar a Geolocation API com `watchPosition`.

A localização deverá ser transmitida ao backend por WebSocket.

Enviar:

- Latitude.
- Longitude.
- Precisão do GPS.
- Velocidade, quando disponível.
- Direção, quando disponível.
- Timestamp.
- Identificador da viagem.

Validar os dados no backend.

### Frequência

Adotar inicialmente atualizações a cada 5–10 segundos, respeitando deslocamento, precisão, consumo de bateria e limites do navegador.

Não transmitir atualizações redundantes quando o veículo estiver parado.

### Mapa

Utilizar Leaflet com OpenStreetMap.

O mapa deverá apresentar:

- Localização atual da VAN.
- Marcador personalizado do veículo.
- Trajeto planejado.
- Pontos de embarque.
- Origem e destino.
- Direção de deslocamento.
- Horário da última atualização.
- Estado da conexão.

Atualizar o marcador sem recarregar a página.

### Tratamento de desconexão

Caso o motorista perca conexão:

- Manter a última localização conhecida.
- Exibir aviso de localização desatualizada.
- Registrar horário da última atualização.
- Tentar reconectar automaticamente.
- Reconciliar atualizações válidas quando a conexão retornar.

Não apresentar uma localização antiga como se fosse atual.

### Limitações importantes

A Geolocation API exige HTTPS ou ambiente seguro e permissão do usuário.

O rastreamento via navegador (incluindo PWA) não garante funcionamento contínuo quando o navegador está fechado, a tela está bloqueada ou o sistema operacional suspende a aplicação.

Implemente o rastreamento web com essas limitações explícitas na interface e na documentação. O escopo atual é exclusivamente web; aplicativo móvel nativo está fora do escopo desta versão.

---

## 8. Gestão de veículos

Criar CRUD completo de veículos.

Campos:

- ID.
- Placa.
- Modelo.
- Fabricante.
- Ano.
- Cor.
- Capacidade de passageiros.
- Identificação interna.
- Status.
- Data de cadastro.

Status possíveis:

- Disponível.
- Em operação.
- Em manutenção.
- Inativo.

A capacidade do veículo deve determinar o limite máximo de reservas confirmadas por viagem.

---

## 9. Gestão de rotas

Criar módulo de rotas.

Cada rota deverá possuir:

- Nome.
- Origem.
- Destino.
- Sentido.
- Pontos de embarque.
- Pontos de desembarque.
- Sequência dos pontos.
- Coordenadas geográficas.
- Distância estimada.
- Duração estimada.
- Status.

### Rotas iniciais

- Rio de Janeiro → Teresópolis.
- Teresópolis → Rio de Janeiro.

Permitir cadastrar diferentes itinerários para cada sentido.

Os pontos reais deverão ser configuráveis pelo administrador. Não inventar endereços oficiais de embarque.

Utilizar serviço de roteamento compatível com OpenStreetMap, com abstração para substituir o provedor futuramente.

---

## 10. Gestão de viagens

Criar viagens vinculadas a:

- Veículo.
- Motorista.
- Rota.
- Data.
- Horário previsto de saída.
- Horário previsto de chegada.
- Capacidade disponível.

### Estados

- Programada.
- Embarque aberto.
- Em andamento.
- Concluída.
- Cancelada.

Implementar transições válidas de estado.

O motorista só poderá iniciar uma viagem atribuída a ele.

Impedir que um mesmo motorista ou veículo seja atribuído a viagens com horários incompatíveis.

Registrar os horários reais de início e encerramento.

---

## 11. Sistema de reservas

Implementar reserva de assentos.

### Fluxo

1. Professor acessa as viagens disponíveis.
2. Seleciona data e horário.
3. Visualiza vagas disponíveis.
4. Escolhe ponto de embarque.
5. Confirma a reserva.
6. Recebe confirmação.
7. A vaga é descontada da capacidade.

### Regras

- Impedir reservas duplicadas para a mesma viagem.
- Impedir reservas acima da capacidade.
- Impedir reserva em viagem cancelada ou encerrada.
- Permitir cancelamento conforme regras configuradas.
- Liberar a vaga após cancelamento.
- Registrar data e hora de cada operação.
- Garantir integridade com transações no PostgreSQL.

Implementar proteção contra condições de corrida: duas pessoas não podem reservar a última vaga simultaneamente.

### Lista de espera

Quando a VAN estiver lotada:

- Permitir entrada em lista de espera.
- Organizar por ordem de solicitação.
- Notificar o próximo professor quando surgir vaga.
- Aplicar prazo configurável para confirmação.

---

## 12. Comunicação em tempo real

Implementar sistema de mensagens por viagem.

### Funcionalidades

- Chat entre motorista e professores vinculados à viagem.
- Mensagens em tempo real.
- Histórico persistido no banco.
- Identificação do remetente.
- Horário de envio.
- Indicador de mensagens não lidas.
- Avisos operacionais destacados.

O motorista poderá enviar avisos como:

- VAN saindo do ponto inicial.
- Trânsito intenso.
- Atraso previsto.
- Chegada ao ponto de embarque.
- Mudança operacional.

Somente participantes autorizados poderão acessar as mensagens da viagem.

---

## 13. Previsão inteligente de chegada

Implementar ETA (Estimated Time of Arrival).

O cálculo inicial deverá considerar:

- Localização atual da VAN.
- Distância restante pela rota.
- Tempo estimado de deslocamento.
- Paradas intermediárias.
- Horário previsto.
- Horário atual.

Criar um serviço independente chamado `EtaService`.

A primeira versão poderá utilizar dados de roteamento e estimativas de duração.

Exibir:

- Chegada prevista.
- Minutos restantes.
- Distância restante.
- Possível atraso.
- Horário da última atualização.

Não apresentar estimativas como se fossem informações reais de trânsito quando o provedor não disponibilizar esse dado.

Preparar a arquitetura para integrar serviços de tráfego em tempo real futuramente.

---

## 14. Sistema de notificações

Implementar central de notificações.

Eventos:

- Reserva confirmada.
- Reserva cancelada.
- Vaga liberada.
- Viagem iniciada.
- VAN próxima ao ponto.
- Atraso identificado.
- Viagem cancelada.
- Nova mensagem.
- Alteração de horário.

### Interface

- Ícone de sino.
- Contador de notificações não lidas.
- Histórico.
- Marcar como lida.
- Filtrar por tipo.

Utilizar notificações internas em tempo real.

Adicionar Web Push posteriormente, respeitando permissões e compatibilidade dos navegadores.

---

## 15. Interface e experiência do usuário

Crie uma interface moderna, minimalista e com identidade própria, com a qualidade visual de produtos SaaS atuais, sem aparência de template genérico.

### Identidade

Nome: VanTrack.

- Mobile-first para professores e motoristas, com layout responsivo completo para desktop.
- Cantos arredondados, cards bem organizados, tipografia moderna e animações discretas.
- Ícones Lucide.
- Tipografia com personalidade nos títulos (por exemplo Bricolage Grotesque) e uma sans legível no corpo (por exemplo Inter).
- Identidade própria: um acento amarelo-âmbar `#FBBF24` reservado ao marcador da van no mapa, para que o veículo seja o elemento mais reconhecível do produto.

### Tema

- O tema deve seguir a preferência do sistema (claro/escuro), com opção manual de troca.
- A tela do motorista deve ser projetada e testada primeiro em tema claro de alto contraste, pensando em uso sob luz do dia.
- Garantir contraste mínimo de 4,5:1 no texto, inclusive em rótulos pequenos.

### Cores base

- Background (escuro): `#09090B`
- Surface (escuro): `#18181B`
- Primary: `#2563EB`
- Success: `#22C55E`
- Warning: `#F59E0B`
- Danger: `#EF4444`
- Acento do veículo: `#FBBF24`

Definir também as versões do tema claro com contraste verificado.

### Status e acessibilidade

- Nunca comunicar estado apenas por cor. Todo status (no horário, atrasada, desatualizada, confirmada, lotada) deve combinar cor, ícone e texto.
- Alvos de toque de no mínimo 44 px; ações principais do motorista com 56 px.
- Usar elementos semânticos (`button`, `a`, `label`), `aria-label` em ícones e foco visível.
- Respeitar `prefers-reduced-motion`.

### O mapa é o elemento principal

- Nas telas do professor, do motorista e do admin, o mapa ocupa a maior parte da tela, com elementos flutuantes por cima: card de ETA, estado da conexão, vagas e alertas.
- Em mobile, usar um bottom sheet sobre o mapa com as informações essenciais.
- Mostrar sempre o estado da conexão com texto, por exemplo "Ao vivo · atualizado há 8 s" ou "Localização desatualizada há 2 min".
- No admin, o monitoramento ao vivo é um mapa grande com lista lateral de viagens e cards de indicadores.

### Experiência mobile (navegador do celular)

Professor: a tela inicial deve responder, em uma olhada, onde está a van, quanto tempo falta, se há reserva e quantas vagas restam. Navegação inferior com 4 itens: Início, Reservas, Mensagens e Perfil.

Motorista: compartilhar localização em poucos toques. A tela de viagem traz o estado do compartilhamento (precisão do GPS e última atualização), botão de pausar, lista de passageiros com "Confirmar embarque" e botões grandes de "Informar atraso" e "Encerrar viagem". Usar a Wake Lock API durante a viagem, com aviso claro das limitações do navegador.

### Menos telas, mais reaproveitamento

Em vez de telas separadas por perfil, criar componentes e páginas compartilhados com visões diferentes conforme o papel:

- Viagem (detalhe): mapa, ETA, status, vagas e passageiros. Professor vê somente leitura e reserva; motorista vê controles; admin vê tudo.
- Mensagens: uma tela única de chat por viagem para todos os perfis.
- Notificações, Histórico e Perfil: páginas únicas para todos os perfis.
- Gestão (admin): usuários, motoristas, veículos, rotas, pontos, viagens e reservas usam o mesmo padrão de listagem, filtros e formulário.

### Telas necessárias

**Públicas**
- Landing page.
- Login.
- Cadastro.
- Recuperação de senha.

**Professor**
- Início.
- Reservar vaga.
- Minhas reservas.
- Viagem.
- Mensagens.
- Notificações.
- Histórico.
- Perfil.

**Motorista**
- Início.
- Minhas viagens.
- Viagem em andamento (compartilhamento de localização, passageiros e ocorrências).
- Mensagens.
- Histórico.
- Perfil.

**Administrador**
- Dashboard.
- Monitoramento ao vivo.
- Gestão (padrão único para usuários, motoristas, veículos, rotas e pontos, viagens e reservas).
- Relatórios.
- Configurações.

### Estados de interface

Toda tela deve ter estados de loading (skeleton), erro, vazio e offline/desatualizado.

---

## 16. Banco de dados

Criar um schema relacional bem estruturado.

Entidades principais:

### users
- id
- name
- email
- password_hash
- role
- phone
- avatar_url
- is_active
- created_at
- updated_at

### refresh_sessions
- id
- user_id
- token_hash
- expires_at
- revoked_at

### vehicles
- id
- plate
- model
- manufacturer
- year
- capacity
- status

### routes
- id
- name
- origin
- destination
- direction
- estimated_distance
- estimated_duration
- is_active

### stops
- id
- name
- address
- latitude
- longitude

### route_stops
- id
- route_id
- stop_id
- stop_order
- estimated_offset_minutes

### trips
- id
- route_id
- vehicle_id
- driver_id
- scheduled_departure
- scheduled_arrival
- actual_departure
- actual_arrival
- status

### reservations
- id
- trip_id
- user_id
- boarding_stop_id
- status
- created_at
- cancelled_at

### waitlist
- id
- trip_id
- user_id
- position
- status
- offered_at
- offer_expires_at

### vehicle_locations
- id
- trip_id
- latitude
- longitude
- accuracy
- speed
- heading
- recorded_at

### messages
- id
- trip_id
- sender_id
- content
- created_at

### notifications
- id
- user_id
- type
- title
- content
- is_read
- created_at

### trip_events
- id
- trip_id
- event_type
- description
- created_at

### audit_logs
- id
- actor_id
- action
- entity_type
- entity_id
- metadata
- created_at

Adicionar chaves estrangeiras, índices, restrições e regras de exclusão adequadas.

Ajustar ou acrescentar tabelas quando necessário.

---

## 17. API REST

Criar endpoints organizados por domínio.

Exemplos:

### Auth
- POST `/auth/register`
- POST `/auth/login`
- POST `/auth/refresh`
- POST `/auth/logout`
- GET `/auth/me`

### Vehicles
- GET `/vehicles`
- POST `/vehicles`
- GET `/vehicles/:id`
- PATCH `/vehicles/:id`
- DELETE `/vehicles/:id`

### Routes
- GET `/routes`
- POST `/routes`
- GET `/routes/:id`
- PATCH `/routes/:id`

### Trips
- GET `/trips`
- POST `/trips`
- GET `/trips/:id`
- PATCH `/trips/:id`
- POST `/trips/:id/start`
- POST `/trips/:id/finish`

### Reservations
- GET `/reservations/me`
- POST `/reservations`
- POST `/reservations/:id/cancel`

### Tracking
- GET `/trips/:id/location`
- GET `/trips/:id/location-history`
- GET `/trips/:id/eta`

### Messages
- GET `/trips/:id/messages`
- POST `/trips/:id/messages`

### Notifications
- GET `/notifications`
- PATCH `/notifications/:id/read`

Documentar todos os endpoints com Swagger.

Utilizar paginação, filtros, ordenação e respostas padronizadas.

---

## 18. WebSockets

Implementar eventos em tempo real.

Eventos sugeridos:

- `trip:started`
- `trip:finished`
- `vehicle:location`
- `vehicle:offline`
- `trip:eta_updated`
- `reservation:created`
- `reservation:cancelled`
- `trip:message`
- `trip:delay`
- `notification:new`

Utilizar salas por viagem.

Autenticar conexões WebSocket e validar a autorização de entrada em cada sala.

Não permitir que usuários acompanhem viagens privadas sem permissão.

---

## 19. Simulador de GPS

Como este é um projeto pessoal, implemente um simulador para desenvolvimento e demonstração.

O simulador deverá:

- Selecionar uma viagem de demonstração.
- Percorrer coordenadas de uma rota.
- Atualizar a localização da VAN.
- Simular velocidade variável.
- Simular paradas.
- Simular atrasos.
- Atualizar o ETA.
- Enviar eventos reais pelo backend.

Criar controles para:

- Iniciar.
- Pausar.
- Continuar.
- Reiniciar.
- Ajustar velocidade da simulação.

**IMPORTANTE:** O simulador deve utilizar os mesmos serviços e eventos do rastreamento real, mantendo uma indicação clara de que a localização é simulada.

Não misturar dados simulados com viagens reais.

---

## 20. Segurança e privacidade

Implementar:

- Autenticação segura.
- RBAC no backend.
- Hash de senhas com Argon2.
- Validação de entrada.
- Proteção contra SQL Injection.
- Rate limiting.
- Configuração restritiva de CORS.
- Proteção contra XSS e CSRF conforme o mecanismo de autenticação.
- Sanitização e validação de mensagens.
- Logs de auditoria.
- Segredos em variáveis de ambiente.
- Controle de acesso a dados de localização.

### Privacidade de localização

O rastreamento só poderá ocorrer durante viagens autorizadas e mediante consentimento do motorista.

Não rastrear o motorista fora do período operacional.

Permitir interromper o compartilhamento.

Definir políticas configuráveis de retenção e exclusão de histórico de localização, observando a LGPD.

Não expor publicamente coordenadas de veículos ou informações pessoais de passageiros.

---

## 21. Relatórios

Implementar relatórios administrativos:

- Viagens por período.
- Taxa de ocupação.
- Quantidade de passageiros.
- Atrasos médios.
- Cancelamentos.
- Utilização dos veículos.
- Histórico de viagens por motorista.

Utilizar Recharts.

Permitir filtros por data, veículo, rota e motorista.

Adicionar exportação CSV.

---

## 22. Testes

Criar testes automatizados.

### Unitários
- Cálculo de vagas.
- Regras de reservas.
- Cancelamentos.
- Lista de espera.
- Transições de viagem.
- Cálculo de ETA.
- Controle de permissões.

### Integração
- Autenticação.
- CRUDs.
- Persistência.
- Transações concorrentes.
- WebSockets.
- Reservas simultâneas.

### E2E
- Cadastro e login.
- Professor reserva uma vaga.
- Motorista inicia uma viagem.
- Localização aparece no mapa.
- Motorista envia mensagem.
- Professor recebe notificação.
- Viagem é encerrada.

Não considerar a implementação concluída sem verificar os principais fluxos.

---

## 23. Seeds e dados de demonstração

Criar dados fictícios para testar o sistema.

Incluir:

- 1 administrador.
- 2 motoristas.
- 10 professores.
- 3 veículos.
- 2 rotas.
- Pontos de embarque fictícios ou claramente identificados como demonstração.
- Viagens programadas.
- Reservas.
- Mensagens.
- Notificações.
- Histórico de localizações simuladas.

Criar credenciais de demonstração configuráveis apenas para ambiente de desenvolvimento.

---

## 24. Etapas de implementação

Desenvolva em etapas, mantendo o projeto executável.

### Fase 1 — Fundação
- Monorepo.
- Configurações.
- Banco de dados.
- Drizzle.
- NestJS.
- Next.js.
- Design system.

### Fase 2 — Autenticação
- Cadastro.
- Login.
- Sessões.
- Permissões.
- Layouts por perfil.

### Fase 3 — Gestão operacional
- Veículos.
- Motoristas.
- Rotas.
- Pontos.
- Viagens.

### Fase 4 — Reservas
- Disponibilidade.
- Reserva.
- Cancelamento.
- Lista de espera.
- Regras de capacidade.

### Fase 5 — Monitoramento
- Mapa.
- GPS.
- WebSockets.
- Histórico.
- Simulador.

### Fase 6 — Comunicação
- Chat.
- Avisos.
- Notificações.
- ETA.

### Fase 7 — Administração
- Dashboards.
- Relatórios.
- Auditoria.
- Configurações.

### Fase 8 — Finalização
- Testes.
- Segurança.
- Responsividade.
- PWA.
- Documentação.
- Preparação para deploy.

---

## 25. Requisitos de qualidade

- Código TypeScript strict.
- Componentes reutilizáveis.
- Sem comentários desnecessários no código.
- Sem funcionalidades falsas.
- Sem botões sem ação.
- Sem dados mockados em produção.
- Estados de loading, erro e vazio.
- Tratamento consistente de exceções.
- Interface acessível.
- Responsividade completa.
- Queries eficientes.
- Integridade transacional.
- Segurança por padrão.

Não implementar toda a aplicação em um único arquivo.

Não utilizar soluções improvisadas quando houver uma abordagem arquitetural adequada.

---

## 26. Documentação

Criar:

- README completo.
- Guia de instalação.
- `.env.example`.
- Descrição da arquitetura.
- Diagrama de entidades.
- Documentação das APIs.
- Documentação dos eventos WebSocket.
- Explicação das regras de negócio.
- Instruções do simulador.
- Guia de testes.
- Orientações de deploy.

---

## 27. Resultado esperado

Ao final, o VanTrack deverá permitir o seguinte cenário:

1. O administrador cadastra uma VAN, um motorista e uma rota.
2. O administrador agenda uma viagem de Teresópolis para o Rio de Janeiro.
3. O professor acessa o sistema e reserva uma vaga.
4. O motorista acessa sua área e inicia a viagem.
5. O navegador solicita autorização para compartilhar a localização.
6. A VAN aparece no mapa dos professores autorizados.
7. A localização é atualizada em tempo real.
8. O sistema apresenta a previsão de chegada.
9. O motorista envia um aviso de atraso.
10. Os professores recebem a notificação.
11. O motorista confirma os embarques.
12. A viagem é concluída.
13. O histórico e os indicadores são atualizados.
14. O administrador consegue consultar os resultados.

Todos esses fluxos devem funcionar com dados persistidos no PostgreSQL e comunicação real entre frontend e backend.

## Instrução final

Comece analisando a arquitetura, os relacionamentos e as dependências entre módulos.

Depois implemente o projeto por fases, priorizando a execução funcional de cada etapa.

Crie os arquivos necessários, implemente os componentes, endpoints, serviços, migrações e testes.

Não pare apenas na apresentação da arquitetura ou na criação de telas.

Quando alguma integração externa exigir credenciais, crie a abstração, a configuração por variável de ambiente e uma alternativa de desenvolvimento.

Ao concluir cada fase, valide a compilação, os testes aplicáveis e a integração entre os módulos antes de avançar.

O resultado deve ser um sistema full stack funcional, profissional, seguro, visualmente moderno e adequado para apresentação em portfólio.