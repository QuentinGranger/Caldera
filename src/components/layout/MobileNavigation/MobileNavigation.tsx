'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, ArrowUpRight, ChevronDown, Menu, X } from 'lucide-react';
import type { NavItem, NavLink, SiteNavigation } from '@/data/navigation';
import { universeChapters } from '@/data/universe';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import styles from './MobileNavigation.module.scss';

/**
 * A game as an accordion: its name opens the whole game and its families,
 * by short name. Open from the start on one of its pages.
 */
function GameAccordion({
  game,
  onNavigate,
}: {
  game: NavItem;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(() =>
    game.children.some(
      ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
    ),
  );
  const id = useId();
  return (
    <>
      <button
        type="button"
        className={styles.accordion}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {game.label}
        <ChevronDown size={20} aria-hidden="true" />
      </button>
      <div id={id} className={styles.accordionPanel} inert={!open}>
        <ul className={styles.accordionLinks}>
          {game.children.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={onNavigate}
                aria-current={pathname === link.href ? 'page' : undefined}
              >
                {link.shortLabel ?? link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function MobileNavigation({
  navigation,
}: {
  navigation: SiteNavigation;
}) {
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

  const close = () => setOpen(false);
  const shopLinks: NavLink[] = [
    ...navigation.productTypes,
    ...navigation.listings,
  ];
  const secondary: { id: string; title: string; links: NavLink[] }[] = [
    {
      id: 'mobile-explore-heading',
      title: 'Extensions et guides',
      links: [
        navigation.extensions,
        navigation.calendar,
        navigation.guides,
        navigation.glossary,
        ...(navigation.questions ? [navigation.questions] : []),
        ...(navigation.news ? [navigation.news] : []),
      ],
    },
    {
      id: 'mobile-service-heading',
      title: 'Aide et compte',
      links: [
        navigation.account,
        { href: '/favoris', label: 'Favoris' },
        navigation.delivery,
        navigation.contact,
      ],
    },
  ];

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
            <li>
              <Link href={navigation.catalogue.href} onClick={close}>
                {navigation.catalogue.label}
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </li>
            {navigation.games.map((game) => (
              <li key={game.href}>
                {game.children.length > 0 ? (
                  <GameAccordion game={game} onNavigate={close} />
                ) : (
                  <Link href={game.href} onClick={close}>
                    {game.label}
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </Link>
                )}
              </li>
            ))}
            {shopLinks.map(({ label, href }) => (
              <li key={href}>
                <Link href={href} onClick={close}>
                  {label}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {secondary.map((group) => (
          <section
            key={group.id}
            className={styles.group}
            aria-labelledby={group.id}
          >
            <p id={group.id} className={styles.eyebrow}>
              {group.title}
            </p>
            <ul className={styles.compactLinks}>
              {group.links.map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} onClick={close}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

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
              onClick={close}
            >
              Tout voir
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>

          <ul className={styles.universeLinks}>
            {universeChapters.map((chapter) => (
              <li key={chapter.slug}>
                <Link href={`/univers/${chapter.slug}`} onClick={close}>
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
