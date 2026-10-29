# Rastreamento e simulador

O navegador usa `watchPosition`, alta precisão e amostras de no mínimo 5 segundos. Posições com menos de 10 metros de deslocamento são suprimidas até 25 segundos; essa atualização periódica informa que o veículo continua parado. O backend valida tempo, precisão, velocidade plausível, consentimento, papel e viagem.

O cliente usa Wake Lock quando disponível. Fechar a aba ou bloquear a tela pode interromper GPS e WebSocket; não há garantia de segundo plano em PWA. O motorista pode pausar o envio. Ao sair da página, o envio local é encerrado. Após desconexão, somente posições recentes são reconciliadas; o backend rejeita pontos anteriores ao último persistido. Posições antigas permanecem no mapa com aviso explícito e timestamp. Após 30 segundos sem atualização a posição é considerada desatualizada.

## Simulador

Requer `SIMULATOR_ENABLED=true`, ambiente diferente de produção e viagem `isDemo=true` em andamento. Disponível a administrador ou motorista atribuído. O simulador recebe geometria do serviço OSRM e percorre suas coordenadas; quando o provedor falha, usa pontos configurados e identifica a estimativa. Não são endereços oficiais de embarque.

Controles: iniciar, pausar, continuar, reiniciar, velocidade 1×/5×/20×, simular parada. Use Informar atraso para disparar o aviso operacional. Ao reiniciar, somente posições dessa viagem demonstrativa são removidas. O estado do simulador é por processo e se perde ao reiniciar a API; dados já enviados permanecem.

Os pontos passam por `TrackingService` e usam os mesmos eventos reais do GPS. `isSimulated` persiste em cada posição. Nenhum dado simulado é inserido em viagem real. O simulador em andamento deve ser pausado ou a viagem encerrada ao terminar a demonstração.

## ETA

`EtaService` calcula distância/duração restante com `RoutingProvider`. OSRM é o adaptador inicial; fallback utiliza distância geográfica ajustada e velocidade média, identificado como aproximado. Paradas intermediárias acrescentam tempo. Não há informação de trânsito real, e isso é mostrado na interface. Provedor público é para demonstração, sem SLA; configure um serviço próprio em produção.
