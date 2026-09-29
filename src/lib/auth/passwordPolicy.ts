import 'server-only';
import {
  haveIBeenPwned,
  isPasswordCompromised,
} from 'better-auth/plugins/haveibeenpwned';

/** better-auth error code of a password found in public breaches. */
export const PASSWORD_COMPROMISED = 'PASSWORD_COMPROMISED';

export const COMPROMISED_MESSAGE =
  'Ce mot de passe apparaît dans des fuites de données connues : choisissez-en un autre.';

/**
 * Refuses passwords listed by Have I Been Pwned on sign-up, change and reset.
 * Only the first 5 characters of the password's SHA-1 leave the server
 * (k-anonymity, padded answers). PASSWORD_BREACH_CHECK=off disables it for
 * offline tests; when the service cannot answer, the password is refused and
 * the visitor is asked to try again (nothing is consumed).
 */
export function breachedPasswordCheck() {
  return haveIBeenPwned({
    enabled: process.env.PASSWORD_BREACH_CHECK !== 'off',
    customPasswordCompromisedMessage: COMPROMISED_MESSAGE,
  });
}

/**
 * Checked before a reset link is used: better-auth consumes the link before
 * hashing the new password, so a refusal there would waste the link. Throws
 * when the service cannot answer.
 */
export async function isBreachedPassword(password: string) {
  if (process.env.PASSWORD_BREACH_CHECK === 'off') return false;
  return isPasswordCompromised(password);
}

export const BREACH_CHECK_UNAVAILABLE =
  'Impossible de vérifier ce mot de passe pour l’instant. Votre lien reste valable : réessayez dans quelques minutes.';
