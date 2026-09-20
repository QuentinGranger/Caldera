import { spawn } from 'node:child_process';
import {
  chmodSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
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

let next;
let stripe;
let nextStarted = false;

function mask(value) {
  return value.replace(
    /(?:[sr]k|pk)_(?:test|live)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+/g,
    '[masqué]',
  );
}

function writeWebhookSecret(secret) {
  const current = readFileSync(envPath, 'utf8');
  const entry = `STRIPE_WEBHOOK_SECRET="${secret}"`;
  const nextEnv = /^\s*STRIPE_WEBHOOK_SECRET\s*=/m.test(current)
    ? current.replace(/^\s*STRIPE_WEBHOOK_SECRET\s*=.*$/m, entry)
    : `${current.replace(/\s*$/, '')}\n${entry}\n`;

  const temporary = `${envPath}.stripe-tmp`;
  writeFileSync(temporary, nextEnv, { mode: 0o600 });
  renameSync(temporary, envPath);
  chmodSync(envPath, 0o600);
}

function startNext() {
  if (nextStarted) return;
  nextStarted = true;

  console.log(
    'Stripe TEST prêt. Démarrage de Next.js avec le bon secret webhook…',
  );

  next = spawn('npm', ['run', 'dev'], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });

  next.on('exit', (code) => {
    if (typeof code === 'number' && code !== 0)
      process.exitCode = code;
  });
}

stripe = spawn(
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
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

let configured = false;

function handleLine(value) {
  const secret = /whsec_[A-Za-z0-9]+/.exec(value)?.[0];

  if (secret && !configured) {
    writeWebhookSecret(secret);
    process.env.STRIPE_WEBHOOK_SECRET = secret;
    configured = true;
    startNext();
    return;
  }

  if (/payment_intent\.|\[\d{3}\]|error|failed|denied/i.test(value))
    console.log(mask(value));
}

for (const stream of [stripe.stdout, stripe.stderr]) {
  let pending = '';
  stream.setEncoding('utf8');

  stream.on('data', (chunk) => {
    pending += chunk;
    const lines = pending.split(/[\r\n]/);
    pending = lines.pop() || '';

    for (const value of lines) handleLine(value);
  });

  stream.on('end', () => {
    if (pending) handleLine(pending);
  });
}

stripe.on('error', () => {
  console.error('Impossible de lancer la CLI Stripe.');
  process.exitCode = 1;
});

stripe.on('exit', (code) => {
  if (next && !next.killed) next.kill('SIGTERM');
  process.exitCode = code ?? process.exitCode ?? 0;
});

function stop() {
  if (stripe && !stripe.killed) stripe.kill('SIGTERM');
  if (next && !next.killed) next.kill('SIGTERM');
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stop();
    process.exit();
  });
}
