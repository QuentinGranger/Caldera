import Link from 'next/link';
import { getPrisma } from '@/lib/db/prisma';
import { newsletterUnsubscribeUrl } from '@/lib/newsletter/tokens';
import { saveCommunicationsAction } from '@/lib/lifecycle/actions';
import { AccountForm } from './AccountForm';
import styles from './Account.module.scss';
export async function CommunicationsPreferences({ email }: { email: string }) {
  const subscriber = await getPrisma().newsletterSubscriber.findUnique({
    where: { email },
  });
  return (
    <section
      id="communications"
      className={styles.panel}
      aria-labelledby="communications-title"
    >
      <h2 id="communications-title">Vos e-mails Caldera</h2>
      <p className={styles.panelLead}>
        Nouveautés disponibles, réassorts et sélections utiles. Les messages de
        commande et les alertes stock demandées restent indépendants.
      </p>
      {subscriber?.status === 'ACTIVE' ? (
        <>
          <AccountForm
            action={saveCommunicationsAction}
            submit="Enregistrer mes préférences"
            id="communications"
          >
            <label>
              <input
                type="checkbox"
                name="personalized"
                defaultChecked={subscriber.personalizedEmails}
              />{' '}
              Je souhaite recevoir les rappels de panier, les nouvelles de mes
              favoris, les recommandations après achat et les nouveautés depuis
              mon dernier achat.
            </label>
            <p>
              Facultatif. Au maximum un message commercial automatique tous les
              trois jours et trois sur trente jours, avec un délai possible
              selon les campagnes déjà reçues. Aucun suivi de navigation ni
              pixel d’ouverture.
            </p>
          </AccountForm>
          <Link href={newsletterUnsubscribeUrl(subscriber.id)}>
            Me désinscrire de tous les e-mails commerciaux
          </Link>
        </>
      ) : (
        <Link href="/newsletter">M’inscrire aux nouvelles de Caldera</Link>
      )}
    </section>
  );
}
