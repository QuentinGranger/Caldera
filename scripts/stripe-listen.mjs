import { spawn } from 'node:child_process';
import { chmodSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = fileURLToPath(new URL('../', import.meta.url));
const envPath = resolve(root, '.env');
dotenv.config({ path: envPath, quiet: true });
const key = process.env.STRIPE_SECRET_KEY;
if (!/^(sk|rk)_test_/.test(key || '')) {
  console.error('Renseignez une clé serveur Stripe TEST dans .env.');
  process.exit(1);
}
// Keys are inherited through the environment, never exposed in process arguments.
const child = spawn(
  'npx',
  [
    '--yes',
    '--package',
    '@stripe/cli@1.51.0',
    'stripe',
    'listen',
    '--skip-update',
    '--latest',
    '--events',
    'payment_intent.succeeded,payment_intent.processing,payment_intent.payment_failed,payment_intent.canceled,payment_intent.requires_action',
    '--forward-to',
    'http://localhost:3000/api/stripe/webhook',
  ],
  {
    cwd: root,
    env: { ...process.env, STRIPE_API_KEY: key },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let configured = false;
function line(value) {
  const secret = /whsec_[A-Za-z0-9]+/.exec(value)?.[0];
  if (secret && !configured) {
    const current = readFileSync(envPath, 'utf8');
    const entry = `STRIPE_WEBHOOK_SECRET="${secret}"`;
    const next = /^\s*STRIPE_WEBHOOK_SECRET\s*=/m.test(current)
      ? current.replace(/^\s*STRIPE_WEBHOOK_SECRET\s*=.*$/m, entry)
      : `${current.replace(/\s*$/, '')}\n${entry}\n`;
    const temporary = `${envPath}.stripe-tmp`;
    writeFileSync(temporary, next, { mode: 0o600 });
    renameSync(temporary, envPath);
    chmodSync(envPath, 0o600);
    configured = true;
    console.log(
      'Stripe TEST : écoute active sur localhost:3000 ; secret enregistré dans .env (masqué).',
    );
  }
  // CLI defaults only show event IDs/status, never print full event payloads.
  if (/payment_intent\.|\[\d{3}\]|error|failed|denied/i.test(value)) {
    console.log(
      value.replace(
        /(?:[sr]k|pk)_(?:test|live)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+/g,
        '[masqué]',
      ),
    );
  }
}
for (const stream of [child.stdout, child.stderr]) {
  let pending = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    pending += chunk;
    const lines = pending.split(/[\r\n]/);
    pending = lines.pop() || '';
    for (const value of lines) line(value);
  });
  stream.on('end', () => {
    if (pending) line(pending);
  });
}
child.on('error', () => {
  console.error('Impossible de lancer la CLI Stripe.');
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (child.pid) {
      try {
        process.kill(-child.pid, signal);
      } catch {
        /* Already stopped. */
      }
    }
  });
}
