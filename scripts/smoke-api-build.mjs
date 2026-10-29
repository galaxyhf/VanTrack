import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config } from 'dotenv';
config({ quiet: true });
const data = await mkdtemp(join(tmpdir(), 'vantrack-build-'));
const child = spawn(process.execPath, ['apps/api/dist/apps/api/src/main.js'], {
  env: {
    ...process.env,
    PORT: '4200',
    NODE_ENV: 'test',
    DATABASE_MODE: 'embedded',
    DATABASE_DATA_DIR: join(data, 'db'),
  },
  stdio: ['ignore', 'ignore', 'pipe'],
});
let stderr = '';
child.stderr.on('data', (chunk) => (stderr += chunk));
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (child.exitCode !== null) throw new Error('A API compilada encerrou antes do healthcheck');
    try {
      const r = await fetch('http://localhost:4200/health');
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {
      /* API ainda iniciando; repetir healthcheck. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!ready) throw new Error('Healthcheck indisponível');
  const doc = await (await fetch('http://localhost:4200/docs-json')).json();
  if (!doc.paths['/trips']?.post?.requestBody) throw new Error('Contrato Swagger ausente');
  console.log(
    `API compilada validada: healthcheck e ${Object.keys(doc.paths).length} caminhos documentados.`,
  );
} catch (e) {
  console.error(e.message);
  if (stderr.includes('Cannot find module'))
    console.error('Falha de resolução de dependências no build.');
  process.exitCode = 1;
} finally {
  child.kill('SIGTERM');
  await new Promise((resolve) => child.once('exit', resolve));
  await rm(data, { recursive: true, force: true });
}
