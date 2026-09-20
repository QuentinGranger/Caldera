import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import net from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = fileURLToPath(new URL('../', import.meta.url));
const envPath = resolve(root, '.env');
const host = '127.0.0.1';
const port = 3000;
const forwardUrl = `http://localhost:${port}/api/stripe/webhook`;

dotenv.config({ path: envPath, quiet: true });

const key = process.env.STRIPE_SECRET_KEY;

if (!/^(sk|rk)_test_/.test(key || '')) {
  console.error('Renseignez une clé serveur Stripe TEST dans .env.');
  process.exit(1);
}

let next;
let stripe;
let stopping = false;

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

function isPortBusy() {
  return new Promise((resolveBusy) => {
    const socket = net.createConnection({ host, port });

    socket.once('connect', () => {
      socket.destroy();
      resolveBusy(true);
    });

    socket.once('error', () => {
      resolveBusy(false);
    });

    socket.setTimeout(750, () => {
      socket.destroy();
      resolveBusy(false);
    });
  });
}

function getWebhookSecret() {
  const result = spawnSync(
    'npx',
    [
      '--yes',
      '--package',
      '@stripe/cli@1.51.0',
      'stripe',
      'listen',
      '--skip-update',
      '--print-secret',
    ],
    {
      cwd: root,
      env: { ...process.env, STRIPE_API_KEY: key },
      encoding: 'utf8',
    },
  );

  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const secret = /whsec_[A-Za-z0-9]+/.exec(output)?.[0];

  if (result.status !== 0 || !secret) {
    console.error(
      'Impossible de récupérer le secret webhook Stripe TEST. Vérifiez stripe login et l’environnement Stripe actif.',
    );
    process.exit(1);
  }

  return secret;
}

async function waitForNext() {
  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {
    if (next?.exitCode !== null && next?.exitCode !== undefined)
      throw new Error('Next.js s’est arrêté avant d’être prêt.');

    try {
      const response = await fetch(`http://${host}:${port}/api/health`, {
        cache: 'no-store',
      });

      if (response.ok) return;
    } catch {
      // Next is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error('Next.js n’a pas démarré sur localhost:3000 dans les 30 s.');
}

function startNext(secret) {
  console.log(
    'Stripe TEST prêt. Démarrage de Next.js avec le bon secret webhook…',
  );

  next = spawn('npm', ['run', 'dev'], {
    cwd: root,
    env: {
      ...process.env,
      STRIPE_WEBHOOK_SECRET: secret,
    },
    stdio: 'inherit',
  });

  next.on('exit', (code) => {
    if (stopping) return;

    console.error(
      `Next.js s’est arrêté${typeof code === 'number' ? ` (code ${code})` : ''}. Arrêt de Stripe CLI.`,
    );

    stop();
    process.exitCode = typeof code === 'number' ? code : 1;
  });
}

function startStripeListener() {
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
      forwardUrl,
    ],
    {
      cwd: root,
      env: { ...process.env, STRIPE_API_KEY: key },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  for (const stream of [stripe.stdout, stripe.stderr]) {
    let pending = '';
    stream.setEncoding('utf8');

    stream.on('data', (chunk) => {
      pending += chunk;
      const lines = pending.split(/[\r\n]/);
      pending = lines.pop() || '';

      for (const value of lines) {
        if (
          /payment_intent\.|\[\d{3}\]|error|failed|denied|ready!/i.test(
            value,
          )
        )
          console.log(mask(value));
      }
    });

    stream.on('end', () => {
      if (pending) console.log(mask(pending));
    });
  }

  stripe.on('error', () => {
    console.error('Impossible de lancer la CLI Stripe.');
    stop();
    process.exitCode = 1;
  });

  stripe.on('exit', (code) => {
    if (stopping) return;

    console.error(
      `Stripe CLI s’est arrêté${typeof code === 'number' ? ` (code ${code})` : ''}.`,
    );

    stop();
    process.exitCode = typeof code === 'number' ? code : 1;
  });
}

function stop() {
  if (stopping) return;
  stopping = true;

  if (stripe && !stripe.killed) stripe.kill('SIGTERM');
  if (next && !next.killed) next.kill('SIGTERM');
}

async function main() {
  if (await isPortBusy()) {
    console.error(
      'Le port 3000 est déjà utilisé. Arrêtez l’ancien serveur Next.js avant de lancer npm run dev:stripe.',
    );
    process.exit(1);
  }

  const secret = getWebhookSecret();

  writeWebhookSecret(secret);
  process.env.STRIPE_WEBHOOK_SECRET = secret;

  startNext(secret);

  try {
    await waitForNext();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    stop();
    process.exit(1);
  }

  console.log(
    'Next.js est prêt avec le secret Stripe courant. Démarrage du forwarding webhook…',
  );

  startStripeListener();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stop();
    process.exit();
  });
}

await main();
