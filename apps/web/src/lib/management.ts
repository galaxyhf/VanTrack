export type Field = {
  name: string;
  label: string;
  type?:
    'text' | 'number' | 'email' | 'password' | 'select' | 'datetime-local' | 'checkbox' | 'stops';
  options?: { value: string; label: string }[];
  source?: string;
  required?: boolean;
  min?: number;
  max?: number;
  hint?: string;
};
export type Resource = {
  label: string;
  singular: string;
  endpoint: string;
  fields: Field[];
  columns: { key: string; label: string }[];
};
const options = (rows: string[][]) => rows.map(([value, label]) => ({ value, label }));
export const resources: Record<string, Resource> = {
  vehicles: {
    label: 'Veículos',
    singular: 'veículo',
    endpoint: '/vehicles',
    columns: [
      { key: 'internalCode', label: 'Identificação' },
      { key: 'plate', label: 'Placa' },
      { key: 'model', label: 'Modelo' },
      { key: 'capacity', label: 'Capacidade' },
      { key: 'status', label: 'Estado' },
    ],
    fields: [
      { name: 'internalCode', label: 'Identificação interna' },
      { name: 'plate', label: 'Placa', hint: 'Sem hífen. Ex.: ABC1D23' },
      { name: 'manufacturer', label: 'Fabricante' },
      { name: 'model', label: 'Modelo' },
      { name: 'year', label: 'Ano', type: 'number', min: 1990, max: 2100 },
      { name: 'color', label: 'Cor' },
      { name: 'capacity', label: 'Capacidade de passageiros', type: 'number', min: 1, max: 60 },
      {
        name: 'status',
        label: 'Estado',
        type: 'select',
        options: options([
          ['available', 'Disponível'],
          ['in_operation', 'Em operação'],
          ['maintenance', 'Em manutenção'],
          ['inactive', 'Inativo'],
        ]),
      },
    ],
  },
  users: {
    label: 'Usuários e motoristas',
    singular: 'usuário',
    endpoint: '/users',
    columns: [
      { key: 'name', label: 'Nome' },
      { key: 'email', label: 'E-mail' },
      { key: 'role', label: 'Perfil' },
      { key: 'isActive', label: 'Ativo' },
    ],
    fields: [
      { name: 'name', label: 'Nome completo' },
      { name: 'email', label: 'E-mail', type: 'email' },
      {
        name: 'role',
        label: 'Perfil',
        type: 'select',
        options: options([
          ['teacher', 'Professor'],
          ['driver', 'Motorista'],
          ['admin', 'Administrador'],
        ]),
      },
      { name: 'phone', label: 'Telefone', required: false },
      {
        name: 'password',
        label: 'Senha inicial / nova senha',
        type: 'password',
        required: false,
        hint: 'Mínimo de 9 caracteres. Ao editar, deixe vazio para manter.',
      },
      { name: 'isActive', label: 'Acesso ativo', type: 'checkbox' },
    ],
  },
  stops: {
    label: 'Pontos',
    singular: 'ponto',
    endpoint: '/stops',
    columns: [
      { key: 'name', label: 'Nome' },
      { key: 'address', label: 'Endereço' },
      { key: 'isDemo', label: 'Demonstração' },
    ],
    fields: [
      { name: 'name', label: 'Nome do ponto' },
      {
        name: 'address',
        label: 'Endereço ou referência',
        hint: 'Cadastre somente pontos autorizados pela operação.',
      },
      { name: 'latitude', label: 'Latitude', type: 'number', min: -90, max: 90 },
      { name: 'longitude', label: 'Longitude', type: 'number', min: -180, max: 180 },
      { name: 'isDemo', label: 'Ponto de demonstração', type: 'checkbox' },
    ],
  },
  routes: {
    label: 'Rotas',
    singular: 'rota',
    endpoint: '/routes',
    columns: [
      { key: 'name', label: 'Nome' },
      { key: 'origin', label: 'Origem' },
      { key: 'destination', label: 'Destino' },
      { key: 'isActive', label: 'Ativa' },
    ],
    fields: [
      { name: 'name', label: 'Nome da rota' },
      { name: 'origin', label: 'Origem' },
      { name: 'destination', label: 'Destino' },
      {
        name: 'direction',
        label: 'Sentido',
        type: 'select',
        options: options([
          ['outbound', 'Rio → Teresópolis'],
          ['inbound', 'Teresópolis → Rio'],
        ]),
      },
      { name: 'estimatedDistance', label: 'Distância estimada (metros)', type: 'number', min: 1 },
      { name: 'estimatedDuration', label: 'Duração estimada (segundos)', type: 'number', min: 1 },
      {
        name: 'stops',
        label: 'Pontos na ordem do trajeto',
        type: 'stops',
        source: 'stops',
        hint: 'Selecione os pontos em sequência, da origem ao destino. O último será de desembarque.',
      },
      { name: 'isActive', label: 'Rota ativa', type: 'checkbox' },
    ],
  },
  trips: {
    label: 'Viagens',
    singular: 'viagem',
    endpoint: '/trips',
    columns: [
      { key: 'route.name', label: 'Rota' },
      { key: 'vehicle.internalCode', label: 'Veículo' },
      { key: 'driver.name', label: 'Motorista' },
      { key: 'scheduledDeparture', label: 'Saída' },
      { key: 'status', label: 'Estado' },
    ],
    fields: [
      { name: 'routeId', label: 'Rota', type: 'select', source: 'routes' },
      { name: 'vehicleId', label: 'Veículo', type: 'select', source: 'vehicles' },
      { name: 'driverId', label: 'Motorista', type: 'select', source: 'drivers' },
      { name: 'scheduledDeparture', label: 'Saída prevista', type: 'datetime-local' },
      { name: 'scheduledArrival', label: 'Chegada prevista', type: 'datetime-local' },
      {
        name: 'isDemo',
        label: 'Viagem de demonstração',
        type: 'checkbox',
        hint: 'O simulador só pode operar em viagens de demonstração.',
      },
    ],
  },
};
export function readKey(row: Record<string, unknown>, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (value, k) =>
        value && typeof value === 'object' ? (value as Record<string, unknown>)[k] : undefined,
      row,
    );
}
