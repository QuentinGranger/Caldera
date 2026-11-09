import { routeKind } from './routes';

/** Full prefetch is reserved for public pages, without fragments or access links. */
export function canPrefetchPage(href: string) {
  return (
    href.startsWith('/') &&
    !href.startsWith('//') &&
    !href.includes('#') &&
    !/^\/univers\/carnets(?:\/|\?|$)/.test(href) &&
    !['ACCOUNT', 'UTILITY'].includes(routeKind(href))
  );
}

/** Native link gestures and fragment destinations never become a page journey. */
export function isPageJourney({
  from,
  to,
  button = 0,
  modified = false,
  target = '',
  download = false,
}: {
  from: URL;
  to: URL;
  button?: number;
  modified?: boolean;
  target?: string;
  download?: boolean;
}) {
  return (
    button === 0 &&
    !modified &&
    !download &&
    (!target || target === '_self') &&
    ['http:', 'https:'].includes(to.protocol) &&
    from.origin === to.origin &&
    !to.hash &&
    from.pathname.replace(/\/$/, '') !== to.pathname.replace(/\/$/, '')
  );
}
