import 'server-only';
import { MondialRelayProvider } from './mondialRelay';

export const shippingProviders = {
  MONDIAL_RELAY: new MondialRelayProvider(),
} as const;
