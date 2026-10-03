import { Container } from '@/components/ui/Container/Container';
import styles from './LoadingSkeleton.module.scss';

function Block({
  className = '',
  dark = false,
}: {
  className?: string;
  dark?: boolean;
}) {
  return (
    <span
      className={`${styles.block} ${dark ? styles.darkBlock : ''} ${className}`}
      aria-hidden="true"
    />
  );
}

function HeroSkeleton({ framed = false }: { framed?: boolean }) {
  return (
    <section className={styles.hero} aria-hidden="true">
      <div className={styles.heroInner}>
        <Block className={styles.heroCrumb} dark />
        <div className={styles.heroCopy}>
          <Block className={styles.heroEyebrow} dark />
          <Block className={styles.heroTitle} dark />
          <Block className={styles.heroLead} dark />
          <Block
            className={`${styles.heroLead} ${styles.heroLeadShort}`}
            dark
          />
          <Block className={styles.heroButton} dark />
        </div>
        {framed && <Block className={styles.heroVisual} dark />}
      </div>
    </section>
  );
}

function ProductCardSkeleton() {
  return (
    <article className={styles.productCard} aria-hidden="true">
      <div className={`${styles.block} ${styles.productVisual}`}>
        <Block className={styles.productBadge} />
      </div>
      <div className={styles.productContent}>
        <Block className={styles.productMeta} />
        <Block className={styles.productTitle} />
        <Block className={styles.productStock} />
        <div className={styles.productBottom}>
          <Block className={styles.productPrice} />
          <Block className={styles.productAdd} />
        </div>
      </div>
    </article>
  );
}

export function CatalogPageSkeleton({
  framed = false,
}: {
  framed?: boolean;
}) {
  return (
    <main
      id="contenu"
      className={styles.loadingMain}
      aria-busy="true"
      aria-label="Chargement du catalogue"
    >
      <span className={styles.srOnly}>Chargement du catalogue…</span>
      <HeroSkeleton framed={framed} />
      <Container>
        <section className={styles.catalogBody} aria-hidden="true">
          <div className={styles.chips}>
            <Block className={styles.chip} />
            <Block className={`${styles.chip} ${styles.chipWide}`} />
            <Block className={styles.chip} />
            <Block className={`${styles.chip} ${styles.chipWide}`} />
          </div>
          <div className={styles.toolbar}>
            <Block className={styles.toolbarCount} />
            <Block className={styles.toolbarSearch} />
            <Block
              className={`${styles.toolbarAction} ${styles.toolbarActionMobile}`}
            />
            <Block
              className={`${styles.toolbarAction} ${styles.toolbarFilters}`}
            />
            <Block
              className={`${styles.toolbarAction} ${styles.toolbarSort}`}
            />
          </div>
          <div className={styles.grid}>
            {Array.from({ length: 8 }, (_, index) => (
              <ProductCardSkeleton key={index} />
            ))}
          </div>
        </section>
      </Container>
    </main>
  );
}

function SetCardSkeleton() {
  return (
    <div className={styles.setCard} aria-hidden="true">
      <Block className={styles.setLabel} />
      <Block className={styles.setTitle} />
      <Block className={styles.setMeta} />
      <Block className={styles.setFooter} />
    </div>
  );
}

export function ExtensionsPageSkeleton() {
  return (
    <main
      id="contenu"
      className={styles.loadingMain}
      aria-busy="true"
      aria-label="Chargement des extensions"
    >
      <span className={styles.srOnly}>Chargement des extensions…</span>
      <HeroSkeleton />
      <Container>
        <div className={styles.catalogBody} aria-hidden="true">
          <div className={styles.chips}>
            <Block className={styles.chip} />
            <Block className={`${styles.chip} ${styles.chipWide}`} />
            <Block className={styles.chip} />
          </div>
          {Array.from({ length: 3 }, (_, section) => (
            <section className={styles.sectionSkeleton} key={section}>
              <Block className={styles.sectionHeading} />
              <Block className={styles.sectionLead} />
              <div className={styles.setGrid}>
                {Array.from({ length: 3 }, (_, index) => (
                  <SetCardSkeleton key={index} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </Container>
    </main>
  );
}

export function ProductPageSkeleton() {
  return (
    <main
      id="contenu"
      className={styles.productPage}
      aria-busy="true"
      aria-label="Chargement du produit"
    >
      <span className={styles.srOnly}>Chargement du produit…</span>
      <Container>
        <Block className={styles.productBreadcrumb} />
        <div className={styles.productHero} aria-hidden="true">
          <div>
            <Block className={styles.gallery} />
            <div className={styles.thumbnails}>
              {Array.from({ length: 3 }, (_, index) => (
                <Block className={styles.thumbnail} key={index} />
              ))}
            </div>
          </div>
          <div className={styles.productInfo}>
            <Block className={styles.productEyebrow} />
            <Block className={styles.productPageTitle} />
            <Block className={styles.productSet} />
            <Block className={styles.productSummary} />
            <Block className={styles.wishlist} />
            <div className={styles.purchase}>
              <Block className={styles.purchasePrice} />
              <Block className={styles.purchaseStock} />
              <div className={styles.purchaseActions}>
                <Block className={styles.purchaseQuantity} />
                <Block className={styles.purchaseButton} />
              </div>
            </div>
          </div>
        </div>
        <section className={styles.productSection} aria-hidden="true">
          <Block className={styles.productSectionTitle} />
          <Block className={styles.productSectionLine} />
          <Block
            className={`${styles.productSectionLine} ${styles.productSectionLineShort}`}
          />
        </section>
        <section className={styles.productSection} aria-hidden="true">
          <Block className={styles.productSectionTitle} />
          <div className={styles.grid}>
            {Array.from({ length: 4 }, (_, index) => (
              <ProductCardSkeleton key={index} />
            ))}
          </div>
        </section>
      </Container>
    </main>
  );
}


export function CalendarPageSkeleton() {
  return (
    <main
      id="contenu"
      className={styles.loadingMain}
      aria-busy="true"
      aria-label="Chargement du calendrier des sorties"
    >
      <span className={styles.srOnly}>Chargement du calendrier…</span>
      <HeroSkeleton />
      <Container>
        <div className={styles.catalogBody} aria-hidden="true">
          <div className={styles.chips}>
            <Block className={styles.chip} />
            <Block className={`${styles.chip} ${styles.chipWide}`} />
            <Block className={styles.chip} />
          </div>
          {Array.from({ length: 2 }, (_, section) => (
            <section className={styles.sectionSkeleton} key={section}>
              <Block className={styles.sectionHeading} />
              <div className={styles.releaseList}>
                {Array.from({ length: 4 }, (_, index) => (
                  <div className={styles.releaseRow} key={index}>
                    <Block className={styles.releaseDate} />
                    <Block className={styles.releaseName} />
                    <Block className={styles.releaseStock} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Container>
    </main>
  );
}
