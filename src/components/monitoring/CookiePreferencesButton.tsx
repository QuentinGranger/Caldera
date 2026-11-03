'use client';

import styles from './CommerceAnalytics.module.scss';

export const OPEN_COOKIE_PREFERENCES_EVENT = 'caldera:cookie-preferences';

export function CookiePreferencesButton({
  measurementId,
}: {
  measurementId?: string;
}) {
  if (!/^G-[A-Z0-9]+$/.test(measurementId ?? '')) return null;

  return (
    <button
      type="button"
      className={styles.preferences}
      onClick={() =>
        window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT))
      }
    >
      Cookies · préférences
    </button>
  );
}
