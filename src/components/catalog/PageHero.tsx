import Image from 'next/image';
import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import {
  Breadcrumb,
  type BreadcrumbItem,
} from '@/components/ui/Breadcrumb/Breadcrumb';
import styles from './PageHero.module.scss';

/**
 * How the view meets the words on wide screens: `backdrop` fills the hero,
 * `arch` and `window` frame it beside the words (an arch, a landscape). On
 * phones the view is always the backdrop.
 */
export type HeroFrame = 'backdrop' | 'arch' | 'window';

export interface HeroView {
  src: string;
  frame: HeroFrame;
  /** Desktop/default focal point (CSS object-position). */
  focus?: string;
  /** Optional phone focal point when the same visual needs another crop. */
  mobileFocus?: string;
  /** Optional phone-only crop zoom. Keep close to 1 to avoid over-cropping. */
  mobileZoom?: number;
  /** Fixed visual height for desktop variants that must stay aligned. */
  desktopHeight?: string;
}

/**
 * The entrance of every catalogue page: where you are, what is sold here,
 * the way in. One height, one type scale, one call to action everywhere;
 * the view and its framing give each page its own face. Short: the
 * products follow right below.
 */
export function PageHero({
  breadcrumb,
  path,
  eyebrow,
  title,
  lead,
  note,
  up,
  action,
  view,
  children,
}: {
  breadcrumb: BreadcrumbItem[];
  path: string;
  eyebrow: string;
  title: string;
  lead: string;
  /** Small print under the lead (what a label means here). */
  note?: string;
  /** A quiet way up to the parent family, under the lead. */
  up?: { href: string; label: string };
  /** The way in: an anchor to the products, or a page. */
  action?: { href: string; label: string };
  view: HeroView;
  /** Under the lead: what the page holds, in a few words. */
  children?: ReactNode;
}) {
  const framed = view.frame !== 'backdrop';
  const desktopFocus = view.focus ?? '50% 45%';
  const mobileFocus = view.mobileFocus ?? desktopFocus;
  const mobileZoom = view.mobileZoom ?? 1;
  const heroStyle = {
    '--focus': desktopFocus,
    '--mobile-focus': mobileFocus,
    '--mobile-zoom': String(mobileZoom),
    '--mobile-drift-zoom': String(Number((mobileZoom * 1.08).toFixed(3))),
    ...(view.desktopHeight
      ? { '--hero-desktop-height': view.desktopHeight }
      : {}),
  } as CSSProperties;
  return (
    <section
      className={styles.hero}
      data-frame={view.frame}
      data-stable-desktop={view.desktopHeight ? '' : undefined}
      style={heroStyle}
      aria-labelledby="page-title"
    >
      {/* Wide screens, framed views: the same view, blurred, colours the
          night around the frame. Never requested on phones (not shown). */}
      {framed && (
        <div className={styles.atmosphere} aria-hidden="true">
          <Image src={view.src} alt="" fill sizes="128px" loading="lazy" />
        </div>
      )}
      <div className={styles.inner}>
        <Breadcrumb items={breadcrumb} currentPath={path} />
        <div className={styles.content}>
          <p className={styles.eyebrow}>
            <span aria-hidden="true" />
            {eyebrow}
          </p>
          <h1 id="page-title">{title}</h1>
          <p className={styles.lead}>{lead}</p>
          {note && <p className={styles.note}>{note}</p>}
          {up && (
            <Link href={up.href} className={styles.up}>
              <ArrowLeft size={16} aria-hidden="true" />
              {up.label}
            </Link>
          )}
          {children}
          {action && (
            <Button href={action.href} variant="gold" className={styles.action}>
              {action.label}
              {action.href.startsWith('#') ? (
                <ArrowDown aria-hidden="true" />
              ) : (
                <ArrowRight aria-hidden="true" />
              )}
            </Button>
          )}
        </div>
        <div className={styles.view} aria-hidden="true">
          <Image
            src={view.src}
            alt=""
            fill
            sizes={
              view.frame === 'arch'
                ? '(min-width: 60rem) 23rem, 100vw'
                : view.frame === 'window'
                  ? '(min-width: 60rem) 30rem, 100vw'
                  : '100vw'
            }
            loading="eager"
            fetchPriority="high"
          />
        </div>
      </div>
    </section>
  );
}

/** What the page holds, quietly: one dot between each, never one starting a line. */
export function HeroRange({
  items,
  label,
}: {
  items: readonly string[];
  label: string;
}) {
  if (!items.length) return null;
  return (
    <ul className={styles.range} aria-label={label}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export interface HeroStat {
  value: number | string;
  label: string;
}

/** Compact factual counters inside a hero, shared by data-led pages. */
export function HeroStats({
  items,
  label = 'Repères',
}: {
  items: readonly HeroStat[];
  label?: string;
}) {
  if (!items.length) return null;
  return (
    <dl className={styles.stats} aria-label={label}>
      {items.map((item) => (
        <div className={styles.stat} key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A set's own logo, under the lead (an official visual, set in the admin). */
export function HeroLogo({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      className={styles.logo}
      src={src}
      alt={alt}
      width={180}
      height={90}
    />
  );
}
