import 'server-only';
import { createHash } from 'node:crypto';

/** Mondial Relay signs the ordered, unseparated field values plus the private key. */
export function mondialRelaySecurity(
  orderedValues: readonly (string | number)[],
  privateKey: string,
) {
  return createHash('md5')
    .update(`${orderedValues.join('')}${privateKey}`, 'utf8')
    .digest('hex')
    .toUpperCase();
}
