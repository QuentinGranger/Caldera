'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';
import type { NavItem, NavLink, SiteNavigation } from '@/data/navigation';
import { universeChapters } from '@/data/universe';
import { IconButton } from '@/components/ui/IconButton/IconButton';
import { DiscordInviteLink } from '@/components/discord/DiscordInviteLink';
import styles from './MobileNavigation.module.scss';

const NEW_ARRIVALS = '/nouveautes';

/** A main entry: the brand's serif, an arrow for a page of the site. */
function MainLink({
  link,
  pathname,
  onNavigate,
}: {
  link: NavLink;
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={link.href}
      className={styles.main}
      onClick={onNavigate}
      aria-current={pathname === link.href ? 'page' : undefined}
    >
      <span>{link.label}</span>
      <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );
}

/** An entry with sub-pages: its name opens them, by short name. */
function Accordion({
  item,
  open,
  onToggle,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  open: boolean;
  onToggle: () => void;
  pathname: string;
  onNavigate: () => void;
}) {
  const id = useId();
  return (
    <>
      <button
        type="button"
        className={styles.main}
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
      >
        <span>{item.label}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      <div id={id} className={styles.accordion} inert={!open}>
        <ul>
          {item.children.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={onNavigate}
                aria-current={pathname === link.href ? 'page' : undefined}
              >
                <span>{link.shortLabel ?? link.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/**
 * The phone menu: under the header, over the whole screen, the page behind
 * locked where it was. The shop first and in full, then the reading, the
 * universe, and last the account and the help. One accordion open at most.
 */
export function MobileNavigation({
  navigation,
  signedIn,
}: {
  navigation: SiteNavigation;
  signedIn: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);

  // The panel starts under the header, wherever it stands (below the
  // announcement bar at the top of the page).
  function placePanel() {
    const header = trigger.current?.closest('header');
    if (header && panel.current)
      panel.current.style.setProperty(
        '--menu-top',
        `${Math.round(header.getBoundingClientRect().bottom)}px`,
      );
  }

  function toggle() {
    if (!open) {
      placePanel();
      setExpanded(null);
      setScrolled(false);
      if (panel.current) panel.current.scrollTop = 0;
    }
    setOpen(!open);
  }

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
      else placePanel();
    }

    // The page stays where it was: nothing to restore on closing.
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('resize', onResize);

    return () => {
      root.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const close = () => setOpen(false);
  const newArrivals = navigation.listings.filter(
    ({ href }) => href === NEW_ARRIVALS,
  );
  const otherListings = navigation.listings.filter(
    ({ href }) => href !== NEW_ARRIVALS,
  );
  const reading: NavLink[] = [
    ...(navigation.extensions ? [navigation.extensions] : []),
    ...(navigation.calendar ? [navigation.calendar] : []),
    navigation.guides,
    navigation.glossary,
    ...(navigation.questions ? [navigation.questions] : []),
    ...(navigation.news ? [navigation.news] : []),
  ];
  const service: NavLink[] = [
    signedIn
      ? { href: '/compte', label: 'Mon compte' }
      : { href: navigation.account.href, label: 'Se connecter' },
    { href: '/favoris', label: 'Favoris' },
    navigation.delivery,
    navigation.contact,
  ];

  return (
    <div ref={wrapper} className={styles.mobile}>
      <IconButton
        ref={trigger}
        label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-expanded={open}
        aria-controls="mobile-navigation"
        onClick={toggle}
      >
        {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </IconButton>

      <nav
        ref={panel}
        id="mobile-navigation"
        className={styles.panel}
        data-open={open || undefined}
        data-menu-scrolled={scrolled || undefined}
        inert={!open}
        aria-label="Navigation mobile"
        onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 4)}
      >
        <div className={styles.content}>
          {navigation.catalogueAvailable && (
            <section className={styles.group} aria-labelledby="mobile-shop">
              <p id="mobile-shop" className={styles.eyebrow}>
                Boutique
              </p>
              <ul className={styles.mainLinks}>
                <li>
                  <MainLink
                    link={navigation.catalogue}
                    pathname={pathname}
                    onNavigate={close}
                  />
                </li>
                {navigation.games.map((game) => (
                  <li key={game.href}>
                    {game.children.length > 0 ? (
                      <Accordion
                        item={game}
                        open={expanded === game.href}
                        onToggle={() =>
                          setExpanded(expanded === game.href ? null : game.href)
                        }
                        pathname={pathname}
                        onNavigate={close}
                      />
                    ) : (
                      <MainLink
                        link={game}
                        pathname={pathname}
                        onNavigate={close}
                      />
                    )}
                  </li>
                ))}
                {[...navigation.families, ...newArrivals].map((link) => (
                  <li key={link.href}>
                    <MainLink
                      link={link}
                      pathname={pathname}
                      onNavigate={close}
                    />
                  </li>
                ))}
              </ul>
              {otherListings.length > 0 && (
                <ul className={styles.minorLinks}>
                  {otherListings.map(({ href, label }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={close}
                        aria-current={pathname === href ? 'page' : undefined}
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className={styles.group} aria-labelledby="mobile-reading">
            <p id="mobile-reading" className={styles.eyebrow}>
              Extensions et guides
            </p>
            <ul className={styles.gridLinks}>
              {reading.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={close}
                    aria-current={pathname === href ? 'page' : undefined}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.group} aria-labelledby="mobile-universe">
            <p id="mobile-universe" className={styles.eyebrow}>
              Explorer Caldera
            </p>
            <ul className={styles.mainLinks}>
              <li>
                <MainLink
                  link={navigation.universe}
                  pathname={pathname}
                  onNavigate={close}
                />
              </li>
            </ul>
            <ol className={styles.chapters}>
              {universeChapters.map((chapter) => {
                const href = `/univers/${chapter.slug}`;
                return (
                  <li key={chapter.slug}>
                    <Link
                      href={href}
                      onClick={close}
                      aria-current={pathname === href ? 'page' : undefined}
                    >
                      <span aria-hidden="true">{chapter.number}</span>
                      {chapter.title}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className={styles.group} aria-labelledby="mobile-community">
            <p id="mobile-community" className={styles.eyebrow}>
              Communauté
            </p>
            <DiscordInviteLink className={styles.discord} onClick={close} />
          </section>

          <section
            className={`${styles.group} ${styles.service}`}
            aria-labelledby="mobile-service"
          >
            <p id="mobile-service" className={styles.eyebrow}>
              Aide et compte
            </p>
            <ul className={styles.gridLinks}>
              {service.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={close}
                    aria-current={pathname === href ? 'page' : undefined}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </nav>
    </div>
  );
}
