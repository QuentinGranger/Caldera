import 'server-only';
import { MondialRelayError } from './errors';

export type MondialRelayConfig = {
  brandCode: string;
  privateKey: string;
  apiUrl: string;
  collectionMode: string;
  deliveryMode: string;
  sender: {
    name: string;
    address1: string;
    address2: string;
    postalCode: string;
    city: string;
    countryCode: string;
    phone: string;
    email: string;
  };
};

const value = (name: string) => process.env[name]?.trim() ?? '';

export function isMondialRelayEnabled() {
  return process.env.MONDIAL_RELAY_ENABLED === 'true';
}

export function getMondialRelayConfig(): MondialRelayConfig {
  if (!isMondialRelayEnabled())
    throw new MondialRelayError(
      'Mondial Relay est temporairement indisponible.',
      'NOT_CONFIGURED',
    );

  const config: MondialRelayConfig = {
    brandCode: value('MONDIAL_RELAY_BRAND_CODE'),
    privateKey: value('MONDIAL_RELAY_PRIVATE_KEY'),
    apiUrl:
      value('MONDIAL_RELAY_API_URL') ||
      'https://api.mondialrelay.com/web_services.asmx',
    collectionMode: value('MONDIAL_RELAY_COLLECTION_MODE'),
    deliveryMode: value('MONDIAL_RELAY_DELIVERY_MODE'),
    sender: {
      name: value('MONDIAL_RELAY_SENDER_NAME'),
      address1: value('MONDIAL_RELAY_SENDER_ADDRESS1'),
      address2: value('MONDIAL_RELAY_SENDER_ADDRESS2'),
      postalCode: value('MONDIAL_RELAY_SENDER_POSTAL_CODE'),
      city: value('MONDIAL_RELAY_SENDER_CITY'),
      countryCode: value('MONDIAL_RELAY_SENDER_COUNTRY') || 'FR',
      phone: value('MONDIAL_RELAY_SENDER_PHONE'),
      email: value('MONDIAL_RELAY_SENDER_EMAIL'),
    },
  };
  const required = [
    config.brandCode,
    config.privateKey,
    config.collectionMode,
    config.deliveryMode,
    config.sender.name,
    config.sender.address1,
    config.sender.postalCode,
    config.sender.city,
    config.sender.countryCode,
    config.sender.phone,
    config.sender.email,
  ];
  if (required.some((entry) => !entry))
    throw new MondialRelayError(
      'La configuration Mondial Relay est incomplète.',
      'NOT_CONFIGURED',
    );
  try {
    const url = new URL(config.apiUrl);
    if (url.protocol !== 'https:') throw new Error();
  } catch {
    throw new MondialRelayError(
      'L’URL du service Mondial Relay est invalide.',
      'INVALID_CONFIG',
    );
  }
  return config;
}
