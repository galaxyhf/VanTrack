import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, dirname, join } from 'node:path';
const root = resolve(import.meta.dirname, '../apps/api/dist');
async function visit(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await visit(path);
    else if (entry.name.endsWith('.js')) {
      let source = await readFile(path, 'utf8');
      for (const name of ['database', 'shared']) {
        let target = relative(
          dirname(path),
          join(root, 'packages', name, 'src/index.js'),
        ).replaceAll('\\', '/');
        if (!target.startsWith('.')) target = './' + target;
        source = source.replaceAll(`require("@vantrack/${name}")`, `require("${target}")`);
      }
      await writeFile(path, source);
    }
  }
}
await visit(root);
