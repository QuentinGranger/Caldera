import { Container } from '@/components/ui/Container/Container';
import catalogStyles from '@/components/catalog/Catalog.module.scss';
import styles from './LoadingSkeletons.module.scss';

function Bone({ className = '' }: { className?: string }) {
  return <span className={`${styles.bone} ${className}`} aria-hidden="true" />;
}

function LoadingStatus({ children }: { children: string }) {
  return (
    <p className={styles.srOnly} role="status" aria-live="polite">
      {children}
    </p>
  );
}

function HeroSkeleton({ family = false }: { family?: boolean }) {
  return (
    <section
      className={`${styles.hero} ${family ? styles.familyHero : ''}`}
      aria-hidden="true"
    >
      <Container>
        <div className={styles.breadcrumb}>
          <Bone className={styles.crumbShort} />
          <Bone className={styles.crumbLong} />
        </div>
        <div className={styles.heroBody}>
          <div className={styles.heroCopy}>
            <Bone className={styles.eyebrow} />
            <Bone className={styles.heroTitle} />
            <Bone className={styles.heroTitleShort} />
            <Bone className={styles.heroLead} />
            <Bone className={styles.heroLeadShort} />
            <Bone className={styles.heroButton} />
          </div>
          <Bone className={styles.heroVisual} />
        </div>
      </Container>
    </section>
  );
}

function ToolbarSkeleton() {
  return (
    <div className={styles.toolbar} aria-hidden="true">
      <Bone className={styles.total} />
      <Bone className={styles.search} />
      <Bone className={styles.filterButton} />
      <Bone className={styles.sortButton} />
    </div>
  );
}

function ChipsSkeleton() {
  return (
    <div className={styles.chips} aria-hidden="true">
      <Bone />
      <Bone />
      <Bone />
      <Bone />
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <article className={styles.productCard} aria-hidden="true">
      <div className={styles.productVisual}>
        <Bone className={styles.badge} />
        <Bone className={styles.image} />
      </div>
      <div className={styles.productCopy}>
        <Bone className={styles.category} />
        <Bone className={styles.productTitle} />
        <Bone className={styles.productTitleShort} />
        <Bone className={styles.stock} />
        <div className={styles.productBottom}>
          <Bone className={styles.price} />
          <Bone className={styles.addButton} />
        </div>
      </div>
    </article>
  );
}

export function CatalogGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={styles.productGrid} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function CatalogPageSkeleton({
  family = false,
}: {
  family?: boolean;
} = {}) {
  return (
    <main
      id="contenu"
      tabIndex={-1}
      className={`${catalogStyles.main} ${catalogStyles.immersive}`}
      aria-busy="true"
    >
      <LoadingStatus>Chargement du catalogue…</LoadingStatus>
      <HeroSkeleton family={family} />
      <Container>
        <section className={styles.catalogBody}>
          <ChipsSkeleton />
          <ToolbarSkeleton />
          <CatalogGridSkeleton />
        </section>
      </Container>
    </main>
  );
}

function SetCardSkeleton() {
  return (
    <article className={styles.setCard} aria-hidden="true">
      <Bone className={styles.setLabel} />
      <Bone className={styles.setLogo} />
      <Bone className={styles.setTitle} />
      <Bone className={styles.setMeta} />
      <div className={styles.setFooter}>
        <Bone className={styles.setCount} />
        <Bone className={styles.setLink} />
      </div>
    </article>
  );
}

export function ExtensionsPageSkeleton() {
  return (
    <main
      id="contenu"
      tabIndex={-1}
      className={`${catalogStyles.main} ${catalogStyles.immersive}`}
      aria-busy="true"
    >
      <LoadingStatus>Chargement des extensions…</LoadingStatus>
      <HeroSkeleton />
      <Container>
        <section className={styles.catalogBody}>
          <ChipsSkeleton />
          {[0, 1, 2].map((section) => (
            <div className={styles.section} key={section} aria-hidden="true">
              <Bone className={styles.sectionEyebrow} />
              <Bone className={styles.sectionTitle} />
              <Bone className={styles.sectionLead} />
              <div className={styles.setGrid}>
                {Array.from({ length: 3 }, (_, index) => (
                  <SetCardSkeleton key={index} />
                ))}
              </div>
            </div>
          ))}
        </section>
      </Container>
    </main>
  );
}

export function CalendarPageSkeleton() {
  return (
    <main
      id="contenu"
      tabIndex={-1}
      className={catalogStyles.main}
      aria-busy="true"
    >
      <LoadingStatus>Chargement du calendrier des sorties…</LoadingStatus>
      <Container>
        <div className={styles.simpleBreadcrumb} aria-hidden="true">
          <Bone className={styles.crumbShort} />
          <Bone className={styles.crumbLong} />
        </div>
        <header className={styles.calendarHeader} aria-hidden="true">
          <Bone className={styles.sectionEyebrow} />
          <Bone className={styles.calendarTitle} />
          <Bone className={styles.calendarLead} />
          <Bone className={styles.calendarLeadShort} />
        </header>
        {[0, 1].map((section) => (
          <section className={styles.calendarSection} key={section} aria-hidden="true">
            <Bone className={styles.sectionEyebrow} />
            <Bone className={styles.sectionTitle} />
            <div className={styles.releaseList}>
              {Array.from({ length: 4 }, (_, index) => (
                <div className={styles.releaseRow} key={index}>
                  <Bone className={styles.releaseDate} />
                  <Bone className={styles.releaseName} />
                  <Bone className={styles.releaseStock} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </Container>
    </main>
  );
}

export function ProductPageSkeleton() {
  return (
    <main
      id="contenu"
      tabIndex={-1}
      className={styles.productPage}
      aria-busy="true"
    >
      <LoadingStatus>Chargement du produit…</LoadingStatus>
      <Container>
        <div className={styles.simpleBreadcrumb} aria-hidden="true">
          <Bone className={styles.crumbShort} />
          <Bone className={styles.crumbLong} />
        </div>
        <div className={styles.productHero} aria-hidden="true">
          <Bone className={styles.gallery} />
          <div className={styles.productInfo}>
            <Bone className={styles.sectionEyebrow} />
            <Bone className={styles.productPageTitle} />
            <Bone className={styles.productPageTitleShort} />
            <Bone className={styles.productSet} />
            <Bone className={styles.productSummary} />
            <Bone className={styles.productSummaryShort} />
            <Bone className={styles.wishlist} />
            <div className={styles.purchase}>
              <Bone className={styles.purchasePrice} />
              <Bone className={styles.purchaseField} />
              <Bone className={styles.purchaseButton} />
            </div>
          </div>
        </div>
        <section className={styles.productSection} aria-hidden="true">
          <Bone className={styles.sectionTitle} />
          <Bone className={styles.detailLine} />
          <Bone className={styles.detailLine} />
          <Bone className={styles.detailLineShort} />
        </section>
      </Container>
    </main>
  );
}
