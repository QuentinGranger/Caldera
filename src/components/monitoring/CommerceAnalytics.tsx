'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  analyticsAllowed,
  measureLocal,
  analyticsLocation,
  CONSENT_KEY,
  safeAnalyticsPath,
} from '@/lib/analytics/client';
import styles from './CommerceAnalytics.module.scss';
import { OPEN_COOKIE_PREFERENCES_EVENT } from './CookiePreferencesButton';
import { startGoogleMeasurement } from '@/lib/analytics/google';

export function CommerceAnalytics({
  measurementId,
  containerId,
  nonce,
}: {
  measurementId?: string;
  containerId?: string;
  nonce?: string;
}) {
  const path = usePathname();
  const configured = /^G-[A-Z0-9]+$/.test(measurementId ?? '');
  const transport =
    useRef<ReturnType<typeof startGoogleMeasurement>>(undefined);
  const [choice, setChoice] = useState<'unknown' | 'yes' | 'no'>('no');
  useEffect(() => {
    if (!configured) return;
    const read = () => {
      try {
        const value = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? 'null');
        setChoice(
          value?.expires > Date.now()
            ? value.accepted
              ? 'yes'
              : 'no'
            : 'unknown',
        );
      } catch {
        setChoice('unknown');
      }
    };
    read();
    const openPreferences = () => setChoice('unknown');
    window.addEventListener('storage', read);
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, openPreferences);
    return () => {
      window.removeEventListener('storage', read);
      window.removeEventListener(
        OPEN_COOKIE_PREFERENCES_EVENT,
        openPreferences,
      );
    };
  }, [configured]);
  useEffect(() => {
    if (!configured || choice !== 'yes' || !measurementId) return;
    const google = startGoogleMeasurement({
      measurementId,
      containerId,
      nonce,
    });
    if (!google) return;
    transport.current = google;
    const send = (event: Event) => {
      if (!analyticsAllowed()) return;
      const detail = (event as CustomEvent).detail;
      if (detail?.name)
        google.send(detail.name, {
          ...detail.data,
          page_location: location.origin + '/catalogue',
          page_referrer: '',
        });
    };
    window.addEventListener('caldera:commerce', send);
    window.dispatchEvent(new Event('caldera:analytics-ready'));
    return () => {
      google.stop();
      transport.current = undefined;
      window.removeEventListener('caldera:commerce', send);
    };
  }, [choice, configured, measurementId, containerId, nonce]);
  useEffect(() => {
    if (choice !== 'yes' || !configured) return;
    const page = analyticsLocation(location.href);
    if (!page) return;
    measureLocal('page_view');
    let referrer = '';
    try {
      referrer = new URL(document.referrer).origin;
    } catch {}
    transport.current?.send('page_view', {
      page_location: page,
      page_title: path === '/' ? 'Caldera' : path,
      page_referrer: referrer,
    });
  }, [path, choice, configured, measurementId, containerId]);
  if (!configured || !safeAnalyticsPath(path)) return null;
  function choose(accepted: boolean) {
    try {
      localStorage.setItem(
        CONSENT_KEY,
        JSON.stringify({ accepted, expires: Date.now() + 180 * 86400000 }),
      );
    } catch {}
    if (!accepted) {
      let visitor: string | null = null;
      try {
        visitor = localStorage.getItem('caldera-measurement-visitor');
      } catch {}
      void fetch('/api/measurement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'withdraw',
          visitor,
        }),
        keepalive: true,
      }).catch(() => {});
      try {
        localStorage.removeItem('caldera-measurement-visitor');
      } catch {}
      const target = window as unknown as { [key: string]: unknown };
      target[`ga-disable-${measurementId}`] = true;
      for (const cookie of document.cookie.split(';')) {
        const name = cookie.split('=')[0]?.trim();
        if (!name?.startsWith('_ga')) continue;
        for (const domain of [
          '',
          location.hostname,
          ...location.hostname
            .split('.')
            .slice(0, -1)
            .map(
              (_, i) => '.' + location.hostname.split('.').slice(i).join('.'),
            ),
        ])
          document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax${domain ? `; Domain=${domain}` : ''}`;
      }
    }
    setChoice(accepted ? 'yes' : 'no');
    window.dispatchEvent(new Event('caldera:consent-changed'));
  }
  return choice === 'unknown' ? (
    <section
      className={styles.banner}
      aria-label="Préférences de mesure d’audience"
    >
      <div>
        <strong>Mesurer pour améliorer Caldera</strong>
        <p>
          Avec votre accord, Google Analytics et les mesures internes de Caldera
          suivent les visites, les lectures des Carnets et le parcours d’achat.
          Les cookies nécessaires au panier restent indépendants.{' '}
          <Link href="/confidentialite">En savoir plus</Link>
        </p>
      </div>
      <div className={styles.actions}>
        <button onClick={() => choose(false)}>Refuser</button>
        <button onClick={() => choose(true)}>Accepter la mesure</button>
      </div>
    </section>
  ) : null;
}
