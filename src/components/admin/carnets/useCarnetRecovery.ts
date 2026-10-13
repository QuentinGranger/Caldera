'use client';
import { useEffect, useRef, useState } from 'react';
import type { CarnetEditorValue } from '@/lib/carnets/admin';
import { parseCarnetContent } from '@/lib/carnets/content';
const fields = [
  'number',
  'title',
  'slug',
  'arcTitle',
  'arcPosition',
  'arcTotal',
  'status',
  'content',
  'illustrationUrl',
  'illustrationAlt',
  'location',
  'earlyAccessAt',
  'productIds',
  'emailSubject',
  'emailPreheader',
] as const;
function snapshot(value: CarnetEditorValue) {
  return JSON.stringify(
    Object.fromEntries(fields.map((key) => [key, value[key]])),
  );
}
function validate(raw: string, initial: CarnetEditorValue) {
  if (raw.length > 110000) throw new Error('size');
  const parsed = JSON.parse(raw),
    value = parsed.value;
  if (
    !value ||
    !Number.isFinite(parsed.savedAt) ||
    Date.now() - parsed.savedAt > 86400000 ||
    parsed.savedAt > Date.now() + 60000
  )
    throw new Error('expired');
  if (
    !Number.isInteger(value.number) ||
    value.number < 1 ||
    value.number > 999999 ||
    !['DRAFT', 'READY'].includes(value.status)
  )
    throw new Error('invalid');
  const next = { ...initial };
  for (const key of fields) {
    if (
      key === 'number' ||
      key === 'status' ||
      key === 'content' ||
      key === 'productIds'
    )
      continue;
    if (
      value[key] !== undefined &&
      (typeof value[key] !== 'string' || value[key].length > 500)
    )
      throw new Error('invalid');
  }
  if (
    !Array.isArray(value.productIds) ||
    value.productIds.length > 3 ||
    new Set(value.productIds).size !== value.productIds.length ||
    value.productIds.some(
      (id: unknown) => typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id),
    )
  )
    throw new Error('products');
  for (const key of fields) Object.assign(next, { [key]: value[key] });
  next.content = parseCarnetContent(value.content);
  return next;
}
export function useCarnetRecovery(
  initial: CarnetEditorValue,
  value: CarnetEditorValue,
) {
  const key = `caldera-carnet-rescue:${initial.id ?? 'new'}`,
    base = snapshot(initial),
    current = snapshot(value),
    waiting = useRef(false);
  const [recovery, setRecovery] = useState<CarnetEditorValue | null>(null),
    [unavailable, setUnavailable] = useState(false),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const backup = validate(raw, initial);
        if (snapshot(backup) !== base) {
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
  }, [key, base, initial]);
  useEffect(() => {
    if (waiting.current) return;
    if (current === base) {
      try {
        sessionStorage.removeItem(key);
      } catch {}
      return;
    }
    const timer = setTimeout(() => {
      try {
        sessionStorage.setItem(
          key,
          JSON.stringify({ value: JSON.parse(current), savedAt: Date.now() }),
        );
        setSaved(true);
      } catch {
        setUnavailable(true);
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [key, base, current, recovery]);
  function dismiss() {
    waiting.current = false;
    setRecovery(null);
    try {
      sessionStorage.removeItem(key);
    } catch {
      setUnavailable(true);
    }
  }
  return { recovery, unavailable, saved, dismiss };
}
