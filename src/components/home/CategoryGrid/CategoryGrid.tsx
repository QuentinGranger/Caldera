import { Container } from '@/components/ui/Container/Container';
import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import { CategoryCard } from '@/components/home/CategoryCard/CategoryCard';
import type { getHomeCategories } from '@/lib/catalog/queries';
import styles from './CategoryGrid.module.scss';
export function CategoryGrid({
  categories,
}: {
  categories: Awaited<ReturnType<typeof getHomeCategories>>;
}) {
  return (
    <section
      id="pokemon"
      className={styles.section}
      aria-labelledby="categories-title"
    >
      <Container>
        <SectionTitle
          id="categories-title"
          eyebrow="À chacun son territoire"
          title="Explorez les terres"
          description="Une première carte, un nouveau coffret, une pièce à chérir. Trouvez votre prochaine découverte."
        />
        <div className={styles.grid}>
          {categories.map((category, index) => (
            <CategoryCard key={category.id} category={category} index={index} />
          ))}
        </div>
      </Container>
    </section>
  );
}
