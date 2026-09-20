'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { navigation } from '@/data/navigation';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import styles from './MobileNavigation.module.scss';
export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        trigger.current?.focus();
      }
    }
    function onPointer(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !wrapper.current?.contains(event.target)
      )
        setOpen(false);
    }
    const query = window.matchMedia('(min-width: 75rem)');
    function onResize() {
      if (query.matches) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    query.addEventListener('change', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      query.removeEventListener('change', onResize);
    };
  }, [open]);
  return (
    <div ref={wrapper} className={styles.mobile}>
      <IconButton
        ref={trigger}
        label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-expanded={open}
        aria-controls="mobile-navigation"
        onClick={() => setOpen(!open)}
      >
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </IconButton>
      <nav
        id="mobile-navigation"
        className={styles.panel}
        hidden={!open}
        aria-label="Navigation mobile"
      >
        <p>Explorez les terres</p>
        <ul>
          {navigation.map(({ label, href }) => (
            <li key={label}>
              <Link href={href} onClick={() => setOpen(false)}>
                {label}
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        <span>Explorez. Collectionnez. Entrez dans Caldera.</span>
      </nav>
    </div>
  );
}
