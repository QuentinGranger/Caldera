import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { hashPassword } from 'better-auth/crypto';
import { getPrisma } from '../src/lib/db/prisma';

async function hiddenPassword(label: string): Promise<string> {
  if (!stdin.isTTY)
    throw new Error(
      'Un terminal interactif est requis pour saisir le mot de passe.',
    );
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    function finish() {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write('\n');
    }
    function onData(data: Buffer) {
      for (const char of data.toString()) {
        if (char === '\u0003') {
          finish();
          reject(new Error('Annulé.'));
          return;
        }
        if (char === '\r' || char === '\n') {
          finish();
          resolve(value);
          return;
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    }
    stdin.on('data', onData);
    stdout.write(label);
  });
}
const db = getPrisma();
try {
  const terminal = createInterface({ input: stdin, output: stdout });
  const email = (await terminal.question('Email administrateur : '))
    .trim()
    .toLowerCase();
  const name = (await terminal.question('Nom : ')).trim();
  terminal.close();
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    !name ||
    name.length > 200
  )
    throw new Error('Nom ou email invalide.');
  const password = await hiddenPassword(
    'Mot de passe (12 à 128 caractères, saisie masquée) : ',
  );
  const confirmation = await hiddenPassword('Confirmer : ');
  if (
    password.length < 12 ||
    password.length > 128 ||
    password !== confirmation
  )
    throw new Error('Mot de passe invalide ou confirmation différente.');
  const userId = randomUUID();
  const hashed = await hashPassword(password);
  await db.adminUser.create({
    data: {
      id: userId,
      email,
      name,
      accounts: {
        create: {
          accountId: userId,
          providerId: 'credential',
          password: hashed,
        },
      },
    },
  });
  console.info('Administrateur créé. Connexion disponible sur /admin/login.');
} catch {
  console.error(
    'Création impossible : saisie invalide, email déjà utilisé ou base indisponible. Aucun mot de passe affiché.',
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
