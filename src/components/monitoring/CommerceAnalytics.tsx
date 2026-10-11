'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  analyticsAllowed,
  measureLocal,
  analyticsLocation,
  CONSENT_KEY,
  safeAnalyticsPath,
} from '@/lib/analytics/client';
import styles from './CommerceAnalytics.module.scss';

type Gtag = (...args: unknown[]) => void;
export function CommerceAnalytics({
  measurementId,
  nonce,
}: {
  measurementId?: string;
  nonce?: string;
}) {
  const path = usePathname();
  const configured = /^G-[A-Z0-9]+$/.test(measurementId ?? '');
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
    window.addEventListener('storage', read);
    return () => window.removeEventListener('storage', read);
  }, [configured]);
  useEffect(() => {
    if (!configured || choice !== 'yes') return;
    const target = window as unknown as {
      dataLayer: unknown[];
      gtag?: Gtag;
      [key: string]: unknown;
    };
    target[`ga-disable-${measurementId}`] = false;
    target.dataLayer ??= [];
    const gtag: Gtag =
      target.gtag ??
      function () {
        // Google’s command queue expects an Arguments object.
        // eslint-disable-next-line prefer-rest-params
        target.dataLayer.push(arguments);
      };
    target.gtag = gtag;
    gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    gtag('js', new Date());
    gtag('config', measurementId, {
      send_page_view: false,
      cookie_expires: 180 * 86400,
      cookie_update: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: location.origin + '/',
      page_title: 'Caldera',
      page_referrer: '',
    });
    const script = document.createElement('script');
    script.async = true;
    script.nonce = nonce ?? '';
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
    const send = (event: Event) => {
      if (!analyticsAllowed()) return;
      const detail = (event as CustomEvent).detail;
      if (detail?.name)
        gtag('event', detail.name, {
          ...detail.data,
          send_to: measurementId,
          page_location: location.origin + '/catalogue',
          page_referrer: '',
        });
    };
    window.addEventListener('caldera:commerce', send);
    window.dispatchEvent(new Event('caldera:analytics-ready'));
    return () => {
      target[`ga-disable-${measurementId}`] = true;
      window.removeEventListener('caldera:commerce', send);
      script.remove();
    };
  }, [choice, configured, measurementId, nonce]);
  useEffect(() => {
    if (choice !== 'yes' || !configured) return;
    const target = window as unknown as { gtag?: Gtag };
    const page = analyticsLocation(location.href);
    if (!page) return;
    measureLocal('page_view');
    let referrer = '';
    try {
      referrer = new URL(document.referrer).origin;
    } catch {}
    target.gtag?.('event', 'page_view', {
      page_location: page,
      page_title: path === '/' ? 'Caldera' : path,
      page_referrer: referrer,
      send_to: measurementId,
    });
  }, [path, choice, configured, measurementId]);
  if (!configured || !safeAnalyticsPath(path)) return null;
  function choose(accepted: boolean) {
    try {
      localStorage.setItem(
        CONSENT_KEY,
        JSON.stringify({ accepted, expires: Date.now() + 180 * 86400000 }),
      );
    } catch {}
    if (!accepted) {
      void fetch('/api/measurement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'withdraw' }),
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
  }
  return choice === 'unknown' ? (
    <section
      className={styles.banner}
      aria-label="Préférences de mesure d’audience"
    >
      <div>
        <strong>Mesurer pour améliorer Caldera</strong>
        <p>
          Avec votre accord, Google Analytics mesure les visites et le parcours
          d’achat. Les cookies nécessaires au panier restent indépendants.{' '}
          <Link href="/confidentialite">En savoir plus</Link>
        </p>
      </div>
      <div className={styles.actions}>
        <button onClick={() => choose(false)}>Refuser</button>
        <button onClick={() => choose(true)}>Accepter la mesure</button>
      </div>
    </section>
  ) : (
    <button className={styles.preferences} onClick={() => setChoice('unknown')}>
      Cookies · préférences
    </button>
  );
}
