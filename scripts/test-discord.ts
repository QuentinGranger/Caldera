import 'dotenv/config';
import { PRODUCTION_SITE_URL } from '../src/lib/site';
import {
  discordWebhookUrl,
  sendDiscordPublication,
} from '../src/lib/discord/webhook';

// Manual CLI only. Never fall back to a public publication webhook.
const webhook = discordWebhookUrl(process.env.DISCORD_WEBHOOK_TEST);
const channelId = process.env.DISCORD_TEST_CHANNEL_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const previousEnabled = process.env.DISCORD_PUBLICATIONS_ENABLED;
const previousAnnouncement = process.env.DISCORD_WEBHOOK_ANNOUNCEMENTS;

try {
  if (
    !webhook ||
    !channelId ||
    !guildId ||
    !/^\d{15,25}$/.test(channelId) ||
    !/^\d{15,25}$/.test(guildId)
  )
    throw new Error('TEST_CONFIGURATION_REQUIRED');

  const response = await fetch(webhook, {
    redirect: 'error',
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('TEST_WEBHOOK_UNAVAILABLE');
  const metadata: unknown = await response.json();
  if (
    typeof metadata !== 'object' ||
    metadata === null ||
    !('channel_id' in metadata) ||
    metadata.channel_id !== channelId ||
    !('guild_id' in metadata) ||
    metadata.guild_id !== guildId
  )
    throw new Error('TEST_DESTINATION_MISMATCH');

  // Enable only this explicit send in this CLI process, never the production worker.
  process.env.DISCORD_WEBHOOK_ANNOUNCEMENTS = webhook.href;
  process.env.DISCORD_PUBLICATIONS_ENABLED = 'true';
  const result = await sendDiscordPublication(
    {
      kind: 'announcement',
      title: 'Test du salon privé Caldera → Discord',
      summary:
        'Message de vérification technique envoyé depuis le backend Caldera. Ce test manuel ne modifie pas l’activation des notifications automatiques de production.',
      path: '/catalogue',
    },
    { origin: PRODUCTION_SITE_URL },
  );

  if (result.status === 'sent') {
    console.info(`Discord : test privé confirmé (${result.messageId}).`);
  } else {
    console.error(`Discord : test non confirmé (${result.status}).`);
    process.exitCode = 1;
  }
} catch {
  // Fetch errors and Discord responses can include the webhook secret.
  console.error(
    'Discord : test privé non envoyé. Vérifiez DISCORD_WEBHOOK_TEST, DISCORD_TEST_CHANNEL_ID et DISCORD_GUILD_ID. Aucun repli vers un salon public.',
  );
  process.exitCode = 1;
} finally {
  if (previousEnabled === undefined)
    delete process.env.DISCORD_PUBLICATIONS_ENABLED;
  else process.env.DISCORD_PUBLICATIONS_ENABLED = previousEnabled;
  if (previousAnnouncement === undefined)
    delete process.env.DISCORD_WEBHOOK_ANNOUNCEMENTS;
  else process.env.DISCORD_WEBHOOK_ANNOUNCEMENTS = previousAnnouncement;
}
