import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import {
  saveShippingCountriesAction,
  saveShippingMethodAction,
} from '@/lib/admin/actions';
import { euros } from '@/lib/admin/format';
import { getAdminShipping } from '@/lib/admin/shipping';
import { CGV_FREE_RELAY_FROM } from '@/lib/legal/cgv';
import { PageHeader, IntegrityWarning } from '@/components/admin/AdminUI';
import { AdminForm } from '@/components/admin/AdminForm';
import {
  Check,
  Field,
  Hidden,
  TextField,
} from '@/components/admin/AdminFields';
import styles from '@/components/admin/Admin.module.scss';

export default async function ShippingAdminPage() {
  const { methods, countries } = await getAdminShipping();
  // The checkout's rule (src/lib/checkout/shipping.ts): active, serving an
  // open country. Demo methods are offered too, flagged as such.
  const live = methods.filter(
    (method) =>
      method.isActive &&
      method.countries.some((country) =>
        countries.some((row) => row.code === country.code && row.isActive),
      ),
  );
  // What /livraison, the FAQ and the CGV speak of: the real methods.
  const published = live.filter((method) => !method.isDevelopment);
  // The CGV (art. 10.5) promise a free relay delivery from this amount.
  const cgvKept = published.some((method) =>
    method.freeFromAmount?.equals(CGV_FREE_RELAY_FROM),
  );
  return (
    <>
      <PageHeader
        title="Livraison"
        description="Tarifs, gratuité, délais et pays : le paiement, la page Livraison, la FAQ et les fiches produit les lisent directement."
      >
        <Link
          href="/livraison"
          target="_blank"
          className={`${styles.button} ${styles.secondaryButton}`}
        >
          <ExternalLink size={16} aria-hidden="true" />
          Voir la page Livraison
        </Link>
      </PageHeader>
      {!live.length && (
        <IntegrityWarning>
          Aucun mode de livraison actif ne dessert un pays ouvert : la boutique
          ne peut plus prendre de commande.
        </IntegrityWarning>
      )}
      {published.length > 0 && !cgvKept && (
        <IntegrityWarning>
          Les CGV (article 10.5) annoncent la livraison en Point Relais offerte
          dès {CGV_FREE_RELAY_FROM} € d’achat, et plus aucun mode actif ne
          l’applique. Mettez les CGV à jour, ou rétablissez ce seuil.
        </IntegrityWarning>
      )}
      <section className={styles.card} aria-labelledby="pays">
        <h2 id="pays">Pays desservis</h2>
        <AdminForm
          action={saveShippingCountriesAction}
          submit="Enregistrer les pays"
          confirm="Fermer un pays retire ses modes de livraison du paiement. Confirmer ?"
        >
          <div className={styles.checks}>
            {countries.map((country) => (
              <Check
                key={country.code}
                name={`active:${country.code}`}
                label={`${country.name} (${country.code})`}
                checked={country.isActive}
              />
            ))}
          </div>
        </AdminForm>
      </section>
      {methods.map((method) => (
        <section
          key={method.id}
          className={styles.card}
          aria-labelledby={`mode-${method.id}`}
        >
          <div className={styles.panelHeader}>
            <h2 id={`mode-${method.id}`}>{method.name}</h2>
            <span
              className={`${styles.badge} ${
                live.includes(method) ? styles.success : ''
              }`}
            >
              {live.includes(method)
                ? method.isDevelopment
                  ? 'Démo · proposé au paiement'
                  : 'Proposé au paiement'
                : 'Non proposé'}
            </span>
          </div>
          <p className={styles.muted}>
            Code <code>{method.code}</code> · {euros(method.price)}
            {method.freeFromAmount
              ? ` · offerte dès ${euros(method.freeFromAmount)}`
              : ''}
            {method._count.checkouts > 0 &&
              ` · choisi dans ${method._count.checkouts} panier${method._count.checkouts > 1 ? 's' : ''} en cours ou passé${method._count.checkouts > 1 ? 's' : ''}`}
          </p>
          {/* No remount key: the saved message stays, React resets the
              fields to the values just saved. */}
          <AdminForm
            action={saveShippingMethodAction}
            submit="Enregistrer ce mode"
            confirm="Désactiver ce mode le retire du paiement pour les prochaines commandes. Confirmer ?"
            confirmWhen="inactive"
          >
            <Hidden name="id" value={method.id} />
            <div className={styles.fields}>
              <Field
                label="Nom affiché"
                name="name"
                defaultValue={method.name}
                maxLength={80}
                required
              />
              <Field
                label="Ordre d’affichage"
                name="sortOrder"
                type="number"
                min={0}
                max={999}
                defaultValue={method.sortOrder}
                required
              />
              <Field
                label="Prix (€)"
                name="price"
                inputMode="decimal"
                defaultValue={method.price.toFixed(2)}
                pattern="\d{1,8}([.,]\d{1,2})?"
                required
              />
              <Field
                label="Offerte dès (€, vide : jamais)"
                name="freeFromAmount"
                inputMode="decimal"
                defaultValue={method.freeFromAmount?.toFixed(2) ?? ''}
                pattern="\d{1,8}([.,]\d{1,2})?"
              />
              <Field
                label="Délai minimum (jours ouvrés)"
                name="estimatedMinDays"
                type="number"
                min={0}
                max={60}
                defaultValue={method.estimatedMinDays ?? ''}
              />
              <Field
                label="Délai maximum (jours ouvrés)"
                name="estimatedMaxDays"
                type="number"
                min={0}
                max={60}
                defaultValue={method.estimatedMaxDays ?? ''}
              />
              <TextField
                label="Description (affichée au paiement)"
                name="description"
                defaultValue={method.description}
                maxLength={300}
              />
            </div>
            <fieldset className={styles.checks}>
              <legend>Pays desservis par ce mode</legend>
              {countries.map((country) => (
                <Check
                  key={country.code}
                  name={`country:${country.code}`}
                  label={`${country.name}${country.isActive ? '' : ' (pays fermé)'}`}
                  checked={method.countries.some(
                    (row) => row.code === country.code,
                  )}
                />
              ))}
            </fieldset>
            <div className={styles.checks}>
              <Check name="isActive" label="Actif" checked={method.isActive} />
            </div>
          </AdminForm>
        </section>
      ))}
      <small>
        Un nouveau mode (autre transporteur, retrait) demande un développement :
        son code relie le paiement, l’expédition et le suivi.
      </small>
    </>
  );
}
