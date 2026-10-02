import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const proxyPath = resolve(projectRoot, 'src/proxy.ts');

const enabled = 'const CONSTRUCTION_CURTAIN_ENABLED = true;';
const disabled = 'const CONSTRUCTION_CURTAIN_ENABLED = false;';

const source = await readFile(proxyPath, 'utf8');

if (source.includes(disabled)) {
  console.log('Caldera est déjà ouverte : le rideau de construction est désactivé.');
  process.exit(0);
}

if (!source.includes(enabled)) {
  throw new Error(
    'Impossible de trouver le marqueur du rideau de construction dans src/proxy.ts.',
  );
}

await writeFile(proxyPath, source.replace(enabled, disabled), 'utf8');

console.log('Caldera est prête à ouvrir.');
console.log('Le rideau de production a été désactivé dans src/proxy.ts.');
console.log('Committe puis pousse cette modification pour la déployer en production.');
