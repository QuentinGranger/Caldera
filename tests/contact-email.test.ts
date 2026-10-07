import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderContactEmail } from '../src/emails/contact';
import { customerReplyLink } from '../src/emails/reply';

const urls = {
  admin: 'https://boutique.example',
  logo: 'https://boutique.example/logo.png',
  site: 'https://www.lesterresdecaldera.fr',
};

test('réclamations : répondre directement au client', async (t) => {
  await t.test('lien de réponse : objet, formule, message cité', () => {
    const href = customerReplyLink({
      to: 'camille+sav@example.com',
      subject: 'Votre demande RET-1\nInjected: x',
      name: 'Camille Test',
      quote: 'Le coffret est arrivé abîmé.\nCoin enfoncé.',
    });
    const url = new URL(href);
    assert.equal(url.protocol, 'mailto:');
    assert.equal(decodeURIComponent(url.pathname), 'camille+sav@example.com');
    // No header injection through the subject.
    assert.equal(
      url.searchParams.get('subject'),
      'Votre demande RET-1 Injected: x',
    );
    const body = url.searchParams.get('body')!;
    assert.match(body, /^Bonjour Camille,\n/);
    assert.match(body, /Les Terres de Caldera/);
    assert.match(body, /> Le coffret est arrivé abîmé\.\n> Coin enfoncé\./);
  });

  await t.test('message de contact : réponse prête et commande liée', () => {
    const email = renderContactEmail(
      {
        name: 'Camille <Test>',
        email: 'camille@example.com',
        topic: 'Commande',
        orderNumber: 'CAL-2026-ABCDEF0123456789ABCD',
        message: 'Il manque un booster.\nMerci de vérifier.',
      },
      urls,
      new Date('2026-10-07T12:00:00Z'),
    );
    assert.equal(
      email.subject,
      'Commande — Camille <Test> — commande CAL-2026-ABCDEF0123456789ABCD',
    );
    assert.ok(email.html.includes('Camille &lt;Test&gt;'));
    assert.ok(!email.html.includes('<Test>'));
    assert.ok(email.html.includes('Répondre à Camille'));
    assert.ok(email.html.includes('href="mailto:camille@example.com?subject='));
    assert.ok(
      email.html.includes(
        `${urls.admin}/admin/commandes?search=CAL-2026-ABCDEF0123456789ABCD`,
      ),
    );
    assert.match(email.text, /Il manque un booster\.\nMerci de vérifier\./);
    assert.match(email.text, /Reçu le 7 octobre 2026/);
  });

  await t.test('sans numéro de commande : pas de lien vers l’admin', () => {
    const email = renderContactEmail(
      {
        name: 'Alex',
        email: 'alex@example.com',
        topic: 'Autre demande',
        orderNumber: '',
        message: 'Bonjour, une question.',
      },
      urls,
    );
    assert.equal(email.subject, 'Autre demande — Alex');
    assert.ok(!email.html.includes('/admin/commandes'));
  });
});
