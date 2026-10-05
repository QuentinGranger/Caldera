import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST } from '../src/app/api/contact/route';
import {
  ContactRequestError,
  readContactBody,
} from '../src/lib/contact/request';

const endpoint = 'http://localhost:3000/api/contact';
const valid = {
  name: 'Camille',
  email: 'camille@example.com',
  topic: 'produit',
  message: 'Bonjour, je cherche un produit.',
};

function json(body: string, headers: Record<string, string> = {}) {
  return new Request(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });
}

test('contact: accepte un objet JSON de taille normale', async () => {
  assert.deepEqual(await readContactBody(json(JSON.stringify(valid))), valid);
});

test('contact: bloque un corps trop grand sans Content-Length', async () => {
  const request = json(
    JSON.stringify({ ...valid, message: 'x'.repeat(21_000) }),
  );
  assert.equal(request.headers.get('content-length'), null);
  await assert.rejects(
    readContactBody(request),
    (error: unknown) =>
      error instanceof ContactRequestError && error.status === 413,
  );
});

test('contact: refuse le type simple utilisable par un formulaire tiers', async () => {
  const response = await POST(
    new Request(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(valid),
    }),
  );
  assert.equal(response.status, 415);
});

test('contact: refuse les origines tierces et le JSON invalide', async () => {
  assert.equal(
    (
      await POST(
        json(JSON.stringify(valid), { Origin: 'https://evil.example' }),
      )
    ).status,
    403,
  );
  assert.equal((await POST(json('{broken'))).status, 400);
  assert.equal((await POST(json('[]'))).status, 400);
});

test('contact: le pot de miel reste neutre sans appeler le fournisseur d’e-mail', async () => {
  const response = await POST(json(JSON.stringify({ website: 'bot.example' })));
  assert.equal(response.status, 200);
});
