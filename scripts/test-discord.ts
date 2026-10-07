import 'dotenv/config';
import { PRODUCTION_SITE_URL } from '../src/lib/site';
import { sendDiscordPublication } from '../src/lib/discord/webhook';

// One explicit test message. No customer data, arbitrary text or public route.
const result = await sendDiscordPublication(
  {
    kind: 'announcement',
    title: 'Test de connexion Caldera → Discord',
    summary:
      'Message de vérification technique envoyé depuis le backend Caldera.',
    path: '/',
  },
  { origin: PRODUCTION_SITE_URL },
);

if (result.status === 'sent') {
  console.info(`Discord : message de test confirmé (${result.messageId}).`);
} else {
  console.error(`Discord : test non confirmé (${result.status}).`);
  process.exitCode = 1;
}
