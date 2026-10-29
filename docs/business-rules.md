# Regras de negócio

## Reservas e fila

A linha da viagem é bloqueada com `SELECT FOR UPDATE` antes de confirmar/cancelar reservas ou alterar a fila. A transação calcula capacidade menos reservas não canceladas menos ofertas válidas. Índices únicos parciais impedem reservas ativas e filas duplicadas por professor/viagem. O ponto deve pertencer à rota e aceitar embarque. Reservas encerram na saída prevista ou quando a viagem muda de estado.

Cancelamento pelo professor exige viagem programada/embarque aberto e antecedência configurável (30 minutos no seed). Administradores podem cancelar reservas confirmadas. A vaga passa primeiro ao próximo da fila. Ofertas possuem prazo configurável (15 minutos); uma rotina a cada 30 segundos expira ofertas e promove o próximo. Aceitar oferta e criar a reserva ocorre na mesma transação. A fila mantém posições históricas, sem renumerar.

## Operação

Transições: programada → embarque aberto → em andamento → concluída. Cancelamento somente antes de iniciar. Somente o motorista atribuído e administradores controlam estados. Horários reais de início e chegada são registrados. Agendamento bloqueia linhas de veículo e motorista e rejeita sobreposição de janelas. Início também verifica viagens em andamento, mesmo que o horário previsto já tenha terminado.

Veículos com viagens abertas não podem ser alterados; rotas e pontos já usados são preservados para manter histórico. Crie uma nova versão do itinerário. Viagem com reservas/fila ativa não pode ser reatribuída. Identificação de demonstração é imutável.

## Acesso e privacidade

Cadastro público sempre professor. Motorista é criado pela administração. JWT curto está vinculado a sessão persistida; refresh aleatório é armazenado somente como SHA-256, com cookie HttpOnly e rotação transacional. Logout revoga a sessão. Senhas usam Argon2id. Recuperação usa token aleatório, hash e prazo de 30 minutos; redefinir invalida outros tokens e sessões.

Professores consultam viagens disponíveis e as próprias viagens históricas. Coordenadas e chat exigem participação confirmada; motoristas só acessam viagens atribuídas; administradores acessam a operação. Cancelamento remove o professor da sala Socket.IO. Mensagens são texto simples, limitadas a 2.000 caracteres e renderizadas pelo React sem HTML.

GPS real exige consentimento do motorista em viagem em andamento. Não é aceito em viagem demo. O servidor rejeita timestamps antigos/futuros, coordenadas inválidas, precisão acima de 500 m e deslocamentos incompatíveis. Atualizações redundantes são suprimidas. Retenção configurável (30 dias) é aplicada de hora em hora. A política precisa ser adequada ao uso real e comunicada aos titulares antes da operação.
