'use client';
import { useEffect, useRef, useState } from 'react';
import type { CampaignEditorValue } from './NewsletterCampaignEditor';
import type { NewsletterDocument } from '@/lib/newsletter/document';
import {
  validateNewsletterBackup as validate,
  newsletterRecoverySnapshot as snapshot,
  type NewsletterBackup as Backup,
} from '@/lib/newsletter/recovery';
/** Tab-only, 24h rescue copy. Never an autosend or a server-side saved draft. */
export function useNewsletterRecovery(
  initial: CampaignEditorValue,
  initialDoc: NewsletterDocument,
  value: CampaignEditorValue,
  doc: NewsletterDocument,
) {
  const key = `caldera-newsletter-rescue:${initial.id ?? 'new'}`;
  const base = snapshot(initial, initialDoc);
  let current = '';
  try {
    current = snapshot(value, doc);
  } catch {
    /* Incomplete URLs cannot be saved as a valid rescue document. */
  }
  const [recovery, setRecovery] = useState<Backup | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const waiting = useRef(false);
  useEffect(() => {
    try {
      if (initial.id) {
        const newRaw = sessionStorage.getItem('caldera-newsletter-rescue:new');
        if (newRaw) {
          try {
            const backup = validate(newRaw);
            if (snapshot(backup.value, backup.doc) === base)
              sessionStorage.removeItem('caldera-newsletter-rescue:new');
          } catch {
            sessionStorage.removeItem('caldera-newsletter-rescue:new');
          }
        }
      }
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const backup = validate(raw);
        if (snapshot(backup.value, backup.doc) !== base) {
          waiting.current = true;
          queueMicrotask(() => setRecovery(backup));
        } else sessionStorage.removeItem(key);
      }
    } catch {
      try {
        sessionStorage.removeItem(key);
      } catch {
        queueMicrotask(() => setUnavailable(true));
      }
    }
  }, [key, base, initial.id]);
  useEffect(() => {
    if (waiting.current || !current) return;
    if (current === base) {
      try {
        sessionStorage.removeItem(key);
      } catch {}
      return;
    }
    const timeout = setTimeout(() => {
      try {
        const content = JSON.parse(current) as Pick<Backup, 'value' | 'doc'>;
        const timestamp = Date.now();
        sessionStorage.setItem(
          key,
          JSON.stringify({ ...content, savedAt: timestamp }),
        );
        setSavedAt(timestamp);
      } catch {
        setUnavailable(true);
      }
    }, 900);
    return () => clearTimeout(timeout);
  }, [key, base, current, recovery]);
  function dismiss() {
    waiting.current = false;
    setRecovery(null);
    setSavedAt(null);
    try {
      sessionStorage.removeItem(key);
    } catch {
      setUnavailable(true);
    }
  }
  return { recovery, savedAt, unavailable, dismiss };
}
