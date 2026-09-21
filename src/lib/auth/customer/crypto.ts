import 'server-only';
import {
  createHash,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from 'node:crypto';

const KEY_LENGTH = 64;
const N = 16_384;
const R = 8;
const P = 1;

function deriveKey(
  password: string,
  salt: string,
  options: { N: number; r: number; p: number; maxmem: number },
) {
  return new Promise<Buffer>((resolve, reject) => {
    nodeScrypt(password, salt, KEY_LENGTH, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashCustomerPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt, {
    N,
    r: R,
    p: P,
    maxmem: 32 * 1024 * 1024,
  });
  return `scrypt$${N}$${R}$${P}$${salt}$${key.toString('hex')}`;
}

export async function verifyCustomerPassword(
  password: string,
  encoded: string,
) {
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n = '', r = '', p = '', salt = '', expectedHex = ''] = parts;
  const params = { N: Number(n), r: Number(r), p: Number(p) };
  if (
    !Number.isSafeInteger(params.N) ||
    !Number.isSafeInteger(params.r) ||
    !Number.isSafeInteger(params.p) ||
    !/^[a-f0-9]{32}$/.test(salt) ||
    !/^[a-f0-9]{128}$/.test(expectedHex)
  )
    return false;
  try {
    const actual = await deriveKey(password, salt, {
      ...params,
      maxmem: 32 * 1024 * 1024,
    });
    return timingSafeEqual(actual, Buffer.from(expectedHex, 'hex'));
  } catch {
    return false;
  }
}

export function randomCustomerToken() {
  const raw = randomBytes(32).toString('hex');
  return { raw, hash: hashCustomerToken(raw) };
}

export function hashCustomerToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}
