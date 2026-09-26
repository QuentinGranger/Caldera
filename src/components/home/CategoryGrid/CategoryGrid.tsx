import { Container } from '@/components/ui/Container/Container';
import { SectionTitle } from '@/components/ui/SectionTitle/SectionTitle';
import { CategoryCard } from '@/components/home/CategoryCard/CategoryCard';
import type { HomeFamily } from '@/components/home/homeData';
import styles from './CategoryGrid.module.scss';
/** « Produits scellés » → « produits scellés »; keeps « ETB ». */
function inSentence(name: string) {
  return /\p{Lu}/u.test(name.slice(1))
    ? name
    : name.charAt(0).toLocaleLowerCase('fr-FR') + name.slice(1);
}
export function CategoryGrid({
  families,
  total,
}: {
  families: HomeFamily[];
  /** Visible products of the whole catalogue. */
  total: number;
}) {
  if (!families.length) return null;
  const names = families.map((family, index) =>
    index ? inSentence(family.name) : family.name,
  );
  const list =
    names.length > 1
      ? `${names.slice(0, -1).join(', ')} et ${names.at(-1)}`
      : names[0];
  return (
    <section
      id="familles"
      className={styles.section}
      aria-labelledby="categories-title"
    >
      <Container>
        <SectionTitle
          id="categories-title"
          eyebrow="Familles de produits"
          title="Explorez les terres"
          description={`${list} : ${total} produit${total > 1 ? 's' : ''} en ligne au total.`}
        />
        <div className={styles.grid}>
          {families.map((family, index) => (
            <CategoryCard key={family.id} family={family} index={index} />
          ))}
        </div>
      </Container>
    </section>
  );
}
