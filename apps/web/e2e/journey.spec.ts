import { test, expect, type BrowserContext } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
const API = 'http://localhost:4100',
  ORIGIN = 'http://localhost:3100';
async function call(context: BrowserContext, path: string, data?: unknown, method = 'POST') {
  const response = await context.request.fetch(API + path, {
    method,
    headers: { Origin: ORIGIN },
    data,
  });
  expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBeTruthy();
  return response.json();
}
async function login(context: BrowserContext, email: string) {
  return call(context, '/auth/login', { email, password: 'VanTrack-Dev-2026!' });
}
async function vehicleFor(context: BrowserContext) {
  const n = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return call(context, '/vehicles', {
    plate: `TST${n[0]}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${n.slice(1)}`,
    internalCode: `E2E-${Date.now()}-${n}`,
    manufacturer: 'Teste',
    model: 'Van E2E',
    year: 2026,
    color: 'Branco',
    capacity: 16,
    status: 'available',
  });
}
async function socketFor(context: BrowserContext) {
  const cookies = await context.cookies(API);
  const socket = io(API, {
    transports: ['websocket'],
    extraHeaders: { Origin: ORIGIN, Cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; ') },
    reconnection: false,
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  return socket;
}
function receive(socket: Socket, event: string) {
  return new Promise<unknown>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Evento ausente: ' + event)), 15000);
    socket.once(event, (data) => {
      clearTimeout(t);
      resolve(data);
    });
  });
}
test('cadastro → reserva → motorista → GPS simulado → chat → notificação → encerramento', async ({
  browser,
}) => {
  const admin = await browser.newContext(),
    teacher = await browser.newContext(),
    driver = await browser.newContext();
  const sockets: Socket[] = [];
  try {
    await login(admin, 'admin@vantrack.demo');
    const driverEmail = `driver-${Date.now()}@example.com`;
    const newDriver = await call(admin, '/users', {
      name: 'Motorista E2E',
      email: driverEmail,
      role: 'driver',
      password: 'VanTrack-Dev-2026!',
      isActive: true,
    });
    await login(driver, driverEmail);
    const driverId = newDriver.id;
    const vehicle = await vehicleFor(admin),
      routes = await call(admin, '/routes', undefined, 'GET');
    const start = new Date(Date.now() + 30 * 86400000 + Math.random() * 86400000);
    const trip = await call(admin, '/trips', {
      routeId: routes.data[0].id,
      vehicleId: vehicle.id,
      driverId,
      scheduledDeparture: start.toISOString(),
      scheduledArrival: new Date(start.getTime() + 7200000).toISOString(),
      isDemo: true,
    });
    const page = await teacher.newPage();
    await page.goto('/cadastro');
    await page.getByLabel('Nome completo').fill('Professor E2E');
    await page.getByLabel('E-mail', { exact: true }).fill(`professor-${Date.now()}@example.com`);
    await page.locator('input[name="password"]').fill('Senha-Teste-2026');
    await page.getByRole('button', { name: 'Criar minha conta' }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.goto(`/app/viagens/${trip.id}`);
    await expect(page.getByRole('heading', { name: 'Seu itinerário' })).toBeVisible();
    await page.getByLabel('Ponto de embarque').selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Confirmar minha vaga' }).click();
    await expect(page.getByText('Sua vaga está confirmada')).toBeVisible();
    const denied = await teacher.request.get(API + '/users');
    expect(denied.status()).toBe(403);
    const forbiddenSocket = await socketFor(teacher);
    sockets.push(forbiddenSocket);
    const privateTrips = await call(admin, '/trips?limit=100', undefined, 'GET');
    const privateId = privateTrips.data.find((t: { id: string }) => t.id !== trip.id).id;
    const deniedEvent = receive(forbiddenSocket, 'exception');
    forbiddenSocket.emit('trip:join', { tripId: privateId });
    await deniedEvent;
    forbiddenSocket.disconnect();
    await call(driver, `/trips/${trip.id}/boarding`);
    await call(driver, `/trips/${trip.id}/start`);
    const socket = await socketFor(teacher);
    sockets.push(socket);
    await new Promise<void>((resolve) =>
      socket.emit('trip:join', { tripId: trip.id }, () => resolve()),
    );
    const locationEvent = receive(socket, 'vehicle:location');
    await call(driver, `/trips/${trip.id}/simulator`, { action: 'start' });
    await locationEvent;
    await expect(page.getByText(/Ao vivo · atualizado/)).toBeVisible();
    const chatEvent = receive(socket, 'trip:message');
    await call(driver, `/trips/${trip.id}/messages`, {
      content: 'Chegando ao ponto. Teste E2E.',
      operational: true,
    });
    await chatEvent;
    await page.goto(`/app/mensagens?viagem=${trip.id}`);
    await expect(page.getByText('Chegando ao ponto. Teste E2E.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Sua mensagem' }).fill('Estou no ponto de embarque.');
    await page.getByRole('button', { name: 'Enviar mensagem' }).click();
    await expect(page.getByText('Estou no ponto de embarque.')).toBeVisible();
    await call(driver, `/trips/${trip.id}/delay`, {
      minutes: 10,
      description: 'Trânsito intenso no trecho de teste.',
    });
    await page.goto('/app/notificacoes');
    await expect(page.getByText('Atraso informado: 10 min')).toBeVisible();
    const rs = await call(teacher, '/reservations/me', undefined, 'GET');
    const reservation = rs.data.find(
      (r: { trip: { id: string } }) => r.trip.id === trip.id,
    ).reservation;
    await call(driver, `/reservations/${reservation.id}/attendance`, { status: 'boarded' });
    await call(driver, `/reservations/${reservation.id}/attendance`, { status: 'alighted' });
    await call(driver, `/trips/${trip.id}/finish`);
    const final = await call(teacher, `/trips/${trip.id}`, undefined, 'GET');
    expect(final.status).toBe('completed');
    expect(final.actualArrival).toBeTruthy();
    await page.goto('/app/historico');
    await expect(page.getByText('Concluída')).toBeVisible();
    const dashboard = await call(admin, '/admin/dashboard', undefined, 'GET');
    expect(dashboard.summary.completed).toBeGreaterThan(0);
  } finally {
    for (const s of sockets) s.disconnect();
    await Promise.all([admin.close(), teacher.close(), driver.close()]);
  }
});
test('refresh rotaciona, logout revoga e mutação exige origem', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    await login(context, 'professor@vantrack.demo');
    const original = (await context.cookies(API + '/auth')).find(
      (c) => c.name === 'vt_refresh',
    )!.value;
    await call(context, '/auth/refresh');
    const current = (await context.cookies(API + '/auth')).find(
      (c) => c.name === 'vt_refresh',
    )!.value;
    expect(current).not.toBe(original);
    const csrf = await context.request.post(API + '/auth/profile', {
      data: { name: 'Falha CSRF' },
    });
    expect(csrf.status()).toBe(403);
    const before = (await context.cookies(API)).find((c) => c.name === 'vt_access')!.value;
    await call(context, '/auth/logout');
    const revoked = await context.request.get(API + '/auth/me', {
      headers: { Cookie: `vt_access=${before}` },
    });
    expect(revoked.status()).toBe(401);
  } finally {
    await context.close();
  }
});
test('interface responsiva sem overflow e rotas protegidas', async ({ browser }) => {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      colorScheme: 'light',
    });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Seu trajeto. Mais tranquilo.' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.goto('/app');
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('E-mail', { exact: true }).fill('admin@vantrack.demo');
    await page.locator('input[name="password"]').fill('VanTrack-Dev-2026!');
    await page.getByRole('button', { name: 'Entrar na minha conta' }).click();
    await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
    await expect(page.locator('.leaflet-container')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: `test-results/dashboard-${width}.png`, fullPage: true });
    await context.close();
  }
});

test('GPS do navegador exige consentimento e pausa ao solicitar', async ({ browser }) => {
  const admin = await browser.newContext(),
    driver = await browser.newContext({
      permissions: ['geolocation'],
      geolocation: { latitude: -22.9068, longitude: -43.1729 },
      colorScheme: 'light',
      viewport: { width: 390, height: 844 },
    });
  try {
    await login(admin, 'admin@vantrack.demo');
    const email = `gps-${Date.now()}@example.com`;
    const person = await call(admin, '/users', {
      name: 'Motorista GPS',
      email,
      role: 'driver',
      isActive: true,
      password: 'VanTrack-Dev-2026!',
    });
    await login(driver, email);
    const vehicle = await vehicleFor(admin),
      routes = await call(admin, '/routes', undefined, 'GET');
    const start = new Date(Date.now() + 60 * 86400000 + Math.random() * 86400000);
    const trip = await call(admin, '/trips', {
      routeId: routes.data[0].id,
      vehicleId: vehicle.id,
      driverId: person.id,
      scheduledDeparture: start.toISOString(),
      scheduledArrival: new Date(start.getTime() + 7200000).toISOString(),
      isDemo: false,
    });
    const page = await driver.newPage();
    await page.goto(`/app/viagens/${trip.id}`);
    await page.getByRole('button', { name: 'Abrir embarque' }).click();
    await page.getByRole('button', { name: 'Iniciar viagem', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Autorizar e compartilhar GPS' })).toBeVisible();
    const before = await call(driver, `/trips/${trip.id}/location`, undefined, 'GET');
    expect(before.location).toBeNull();
    await page.getByRole('button', { name: 'Autorizar e compartilhar GPS' }).click();
    await expect
      .poll(async () => {
        const p = await call(driver, `/trips/${trip.id}/location`, undefined, 'GET');
        return p.location?.isSimulated;
      })
      .toBe(false);
    await expect(page.getByText('Compartilhando localização', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/driver-390-light.png', fullPage: true });
    await page.getByRole('button', { name: 'Pausar compartilhamento' }).click();
    await expect(page.getByText('Localização pausada', { exact: true })).toBeVisible();
    const paused = await call(driver, `/trips/${trip.id}/location`, undefined, 'GET');
    expect(paused.paused).toBe(true);
    expect(paused.stale).toBe(true);
    const rejected = await driver.request.post(`${API}/trips/${trip.id}/location`, {
      headers: { Origin: ORIGIN },
      data: {
        tripId: trip.id,
        latitude: -22.9068,
        longitude: -43.1729,
        accuracy: 10,
        recordedAt: new Date().toISOString(),
      },
    });
    expect(rejected.status()).toBe(403);
    await call(driver, `/trips/${trip.id}/finish`);
  } finally {
    await Promise.all([admin.close(), driver.close()]);
  }
});

test('recuperação de senha usa token único e revoga a sessão', async ({ browser }) => {
  const context = await browser.newContext();
  try {
    const email = `recovery-${Date.now()}@example.com`;
    const user = await call(context, '/auth/register', {
      name: 'Professor Recuperação',
      email,
      password: 'Senha-Inicial-2026',
    });
    await call(context, '/auth/forgot-password', { email });
    const { readFile } = await import('node:fs/promises');
    const link = await readFile(`/tmp/vantrack-mail/${user.id}.txt`, 'utf8');
    const token = new URL(link).searchParams.get('token');
    await call(context, '/auth/reset-password', { token, password: 'Nova-Senha-2026' });
    const replay = await context.request.post(API + '/auth/reset-password', {
      headers: { Origin: ORIGIN },
      data: { token, password: 'Outra-Senha-2026' },
    });
    expect(replay.status()).toBe(400);
    const revoked = await context.request.get(API + '/auth/me');
    expect(revoked.status()).toBe(401);
    await call(context, '/auth/login', { email, password: 'Nova-Senha-2026' });
  } finally {
    await context.close();
  }
});
