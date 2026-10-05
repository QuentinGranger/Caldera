/** Local HTTP previews need persistent cookies even in a production build. */
export function secureCookieForHost(
  host: string | null,
  protocol: string | null,
  productionBuild = process.env.NODE_ENV === 'production',
) {
  if (!productionBuild) return false;
  // Vercel is a public HTTPS deployment even if a forwarded Host is forged.
  if (process.env.VERCEL === '1' || process.env.VERCEL_ENV) return true;
  if (protocol === 'https') return true;
  if (!host) return true;

  let hostname: string;
  try {
    hostname = new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return true;
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]')
    return false;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname))
    return false;
  return true;
}
