'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Menu, X } from 'lucide-react';
import { navigation } from '@/data/navigation';
import { universeChapters } from '@/data/universe';
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
      ) {
        setOpen(false);
      }
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
        <section className={styles.group} aria-labelledby="mobile-shop-heading">
          <p id="mobile-shop-heading" className={styles.eyebrow}>
            Boutique
          </p>
          <ul className={styles.mainLinks}>
            {navigation.map(({ label, href }) => (
              <li key={label}>
                <Link href={href} onClick={() => setOpen(false)}>
                  {label}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section
          className={`${styles.group} ${styles.universeGroup}`}
          aria-labelledby="mobile-universe-heading"
        >
          <div className={styles.universeHeading}>
            <div>
              <p className={styles.eyebrow}>Explorer Caldera</p>
              <h2 id="mobile-universe-heading">Univers</h2>
            </div>
            <Link
              href="/univers"
              className={styles.allUniverse}
              onClick={() => setOpen(false)}
            >
              Tout voir
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>

          <ul className={styles.universeLinks}>
            {universeChapters.map((chapter) => (
              <li key={chapter.slug}>
                <Link
                  href={`/univers/${chapter.slug}`}
                  onClick={() => setOpen(false)}
                >
                  <span className={styles.chapterNumber}>{chapter.number}</span>
                  <span className={styles.chapterCopy}>
                    <strong>{chapter.title}</strong>
                    <small>{chapter.label}</small>
                  </span>
                  <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <span className={styles.signature}>
          Explorez. Collectionnez. Entrez dans Caldera.
        </span>
      </nav>
    </div>
  );
}
