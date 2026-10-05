'use client';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * Token of an e-mailed link, read from the URL fragment (#token=…): a
 * fragment is never sent to the server, so it stays out of access logs and
 * Referer headers. It is then removed from the address bar and the history.
 */
export function LinkTokenInput({
  missing,
  className,
}: {
  /** Shown when the page was opened without a token. */
  missing: ReactNode;
  className?: string;
}) {
  // null until read in the browser: nothing is shown during server render.
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    const fromFragment = new URLSearchParams(window.location.hash.slice(1)).get(
      'token',
    );
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once, browser only
    setToken(fromFragment || '');
    if (window.location.hash || window.location.search)
      window.history.replaceState(null, '', window.location.pathname);
  }, []);
  return (
    <>
      <input type="hidden" name="token" value={token ?? ''} />
      {token === '' && (
        <p role="alert" className={className}>
          {missing}
        </p>
      )}
    </>
  );
}
