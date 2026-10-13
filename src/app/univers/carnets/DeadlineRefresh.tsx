'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
/** Refresh an already-open gate/archive at its next transition; access still belongs to the server. */
export function DeadlineRefresh({ at }: { at: string | null }) {
  const router = useRouter();
  useEffect(() => {
    if (!at) return;
    let timer: ReturnType<typeof setTimeout>;
    let refreshed = false;
    const check = () => {
      if (refreshed) return;
      const left = new Date(at).getTime() - Date.now();
      if (left <= 0) {
        refreshed = true;
        router.refresh();
      } else timer = setTimeout(check, Math.min(left + 100, 2147483647));
    };
    check();
    window.addEventListener('focus', check);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', check);
    };
  }, [at, router]);
  return null;
}
