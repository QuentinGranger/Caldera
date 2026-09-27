// Customer account input rules. Pure module: shared by forms and server actions.

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;
export const NAME_MAX = 80;
export const ACCOUNT_PATH = '/compte';
export const SIGN_IN_PATH = '/compte/connexion';

export type AccountActionState = {
  success: boolean;
  message: string;
  errors?: Record<string, string>;
};

export const initialAccountState: AccountActionState = {
  success: false,
  message: '',
};

const CONTROL = /[\u0000-\u001f\u007f]/;

export function accountName(value: unknown) {
  if (typeof value !== 'string' || CONTROL.test(value)) return null;
  const name = value.trim().replace(/\s+/g, ' ');
  return name && name.length <= NAME_MAX ? name : null;
}

export function accountEmail(value: unknown) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return null;
  const [local, domain] = email.split('@');
  return local &&
    local.length <= 64 &&
    domain
      ?.split('.')
      .every((part) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part))
    ? email
    : null;
}

/** Length only (NIST): no composition rule, any character allowed. */
export function accountPassword(value: unknown) {
  return typeof value === 'string' &&
    value.length >= PASSWORD_MIN &&
    value.length <= PASSWORD_MAX
    ? value
    : null;
}

/**
 * Where to go after signing in: a path of this site only, never another host
 * (« //exemple.com », « /\exemple.com ») nor a private API.
 */
export function safeReturnPath(value: unknown) {
  if (
    typeof value !== 'string' ||
    value.length > 300 ||
    !/^\/(?![/\\])/.test(value) ||
    CONTROL.test(value) ||
    value.startsWith('/api/')
  )
    return ACCOUNT_PATH;
  return value;
}
