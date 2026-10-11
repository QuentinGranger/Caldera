import { getPrisma } from '@/lib/db/prisma';
import { AdminTable } from './AdminUI';
import { formatDate } from '@/lib/admin/format';
import styles from './Admin.module.scss';
const labels: Record<string, string> = {
  WELCOME: 'Bienvenue',
  CART_FIRST: 'Panier — premier rappel',
  CART_SECOND: 'Panier — dernier rappel',
  NEW_ARRIVAL: 'Nouveauté disponible',
  POST_PURCHASE: 'Après livraison',
  COMPLEMENTS: 'Produits complémentaires',
  FAVORITE_RESTOCK: 'Favori réapprovisionné',
  FAVORITE_PRICE: 'Prix d’un favori',
  LOW_STOCK: 'Favori — dernières pièces',
  WIN_BACK: 'Client inactif',
};
export async function LifecycleEmailStatus() {
  const deliveries = await getPrisma().lifecycleDelivery.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: {
      id: true,
      kind: true,
      status: true,
      sentAt: true,
      lastError: true,
      createdAt: true,
    },
  });
  const enabled =
    process.env.LIFECYCLE_EMAILS_ENABLED === 'true' &&
    process.env.EMAILS_ENABLED === 'true';
  return (
    <section className={styles.card} aria-labelledby="automations-title">
      <h2 id="automations-title">E-mails automatiques</h2>
      <p>
        {enabled
          ? 'Automatismes activés'
          : 'Envois désactivés par la configuration'}
        {process.env.CATALOG_DEMO_MODE === '1'
          ? ' · Les annonces de produits restent suspendues en mode démonstration.'
          : ''}
      </p>
      <p>
        Panier à J+1 puis J+4 ; après livraison confirmée à J+3 ; compléments à
        J+14 ; inactivité à J+75. Pas plus d’un message commercial automatique
        tous les 3 jours et 3 sur 30 jours. Les campagnes reçues et alertes
        stock récentes peuvent reporter un envoi. Aucun code promotionnel
        automatique.
      </p>
      <p>
        Les recommandations personnalisées nécessitent un consentement distinct.
        Les nouveautés utilisent uniquement les produits publiés, disponibles et
        marqués « Nouveauté ». Une observation initiale du stock ne déclenche
        jamais un faux réassort.
      </p>
      {deliveries.length ? (
        <AdminTable
          caption="Derniers événements automatiques"
          headings={['Scénario', 'État', 'Création', 'Envoi', 'Diagnostic']}
        >
          <>
            {deliveries.map((d) => (
              <tr key={d.id}>
                <td>{labels[d.kind] ?? d.kind}</td>
                <td>{d.status}</td>
                <td>{formatDate(d.createdAt)}</td>
                <td>{d.sentAt ? formatDate(d.sentAt) : '—'}</td>
                <td>{d.lastError ?? '—'}</td>
              </tr>
            ))}
          </>
        </AdminTable>
      ) : (
        <p>Aucun événement à envoyer pour le moment.</p>
      )}
    </section>
  );
}
