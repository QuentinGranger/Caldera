import { createHash } from 'node:crypto';

/**
 * Offline stand-in for api.pwnedpasswords.com (k-anonymity range API): the
 * passwords given to `breach` are answered as found in leaks, every other
 * request goes to the real fetch.
 */
export function mockPwnedPasswords() {
  const original = globalThis.fetch;
  const breached = new Set<string>();
  const ranges: string[] = [];
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = input instanceof Request ? input.url : String(input);
    const match =
      /^https:\/\/api\.pwnedpasswords\.com\/range\/([0-9A-F]{5})$/.exec(url);
    if (!match) return original(input, init);
    ranges.push(match[1]!);
    const lines = [...breached]
      .map((password) =>
        createHash('sha1').update(password).digest('hex').toUpperCase(),
      )
      .filter((hash) => hash.startsWith(match[1]!))
      .map((hash) => `${hash.slice(5)}:42`);
    // Padding entry, as with the Add-Padding header.
    lines.push(`${'0'.repeat(35)}:0`);
    return new Response(lines.join('\r\n'), { status: 200 });
  }) as typeof fetch;
  return {
    breach: (password: string) => breached.add(password),
    /** Range prefixes asked: never the password nor its full hash. */
    ranges,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}
