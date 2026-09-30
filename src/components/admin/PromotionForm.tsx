'use client';
import { useState } from 'react';
import { AdminForm } from '@/components/admin/AdminForm';
import { Hidden } from '@/components/admin/AdminFields';
import { savePromotionAction } from '@/lib/promotions/admin-actions';
import styles from './Admin.module.scss';

export type PromotionFormValue = {
  id?: string;
  code: string;
  label: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  percentOff: string;
  amountOff: string;
  minimumSubtotal: string;
  startsAt: string;
  endsAt: string;
  maxRedemptions: string;
  maxPerCustomer: string;
  isActive: boolean;
  gameId: string;
  categoryId: string;
};

export function PromotionForm({
  value,
  games,
  categories,
  locked,
}: {
  value: PromotionFormValue;
  games: { id: string; name: string }[];
  categories: { id: string; name: string; depth: number }[];
  /** Already used: the code itself can no longer change. */
  locked: boolean;
}) {
  const [type, setType] = useState(value.type);
  return (
    <AdminForm
      action={savePromotionAction}
      submit={value.id ? 'Enregistrer' : 'Créer le code'}
    >
      {value.id && <Hidden name="id" value={value.id} />}
      <div className={styles.fields}>
        <label>
          Code
          <input
            name="code"
            defaultValue={value.code}
            required
            maxLength={32}
            readOnly={locked}
            autoCapitalize="characters"
            spellCheck={false}
            aria-describedby="promotion-code-help"
          />
          <small id="promotion-code-help">
            {locked
              ? 'Déjà utilisé : le code ne peut plus changer.'
              : '3 à 32 caractères : lettres, chiffres, tirets. Enregistré en majuscules.'}
          </small>
        </label>
        <label>
          Libellé affiché au client
          <input
            name="label"
            defaultValue={value.label}
            required
            maxLength={80}
            placeholder="ex. Bienvenue −10 %"
          />
        </label>
        <label>
          Type de réduction
          <select
            name="type"
            value={type}
            onChange={(event) =>
              setType(event.target.value as PromotionFormValue['type'])
            }
          >
            <option value="PERCENTAGE">Pourcentage des articles</option>
            <option value="FIXED_AMOUNT">Montant fixe sur les articles</option>
            <option value="FREE_SHIPPING">Livraison offerte</option>
          </select>
        </label>
        {type === 'PERCENTAGE' && (
          <label>
            Pourcentage (1 à 90)
            <input
              name="percentOff"
              type="number"
              min={1}
              max={90}
              step={1}
              required
              defaultValue={value.percentOff}
            />
          </label>
        )}
        {type === 'FIXED_AMOUNT' && (
          <label>
            Montant (€)
            <input
              name="amountOff"
              inputMode="decimal"
              required
              placeholder="ex. 5,00"
              defaultValue={value.amountOff}
            />
          </label>
        )}
        <label>
          Minimum d’articles (€) — facultatif
          <input
            name="minimumSubtotal"
            inputMode="decimal"
            placeholder="ex. 50,00"
            defaultValue={value.minimumSubtotal}
          />
        </label>
        <label>
          Valable à partir du — facultatif
          <input name="startsAt" type="date" defaultValue={value.startsAt} />
        </label>
        <label>
          Jusqu’au (inclus) — facultatif
          <input name="endsAt" type="date" defaultValue={value.endsAt} />
        </label>
        <label>
          Utilisations au total — facultatif
          <input
            name="maxRedemptions"
            type="number"
            min={1}
            step={1}
            defaultValue={value.maxRedemptions}
          />
        </label>
        <label>
          Utilisations par client (e-mail) — facultatif
          <input
            name="maxPerCustomer"
            type="number"
            min={1}
            step={1}
            defaultValue={value.maxPerCustomer}
          />
        </label>
        <label>
          Réservé à un jeu — facultatif
          <select name="gameId" defaultValue={value.gameId}>
            <option value="">Tous les jeux</option>
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Réservé à une catégorie — facultatif
          <select name="categoryId" defaultValue={value.categoryId}>
            <option value="">Toutes les catégories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {'— '.repeat(category.depth)}
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.full}>
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={value.isActive}
          />
          Code actif (décochez pour le suspendre sans le supprimer)
        </label>
        <p className={`${styles.full} ${styles.muted}`}>
          Un seul code par commande. La réduction porte sur les articles
          concernés (et la livraison pour « Livraison offerte ») ; elle
          n’amène jamais le montant à payer sous 0,50 €. Une utilisation est
          comptée dès le passage au paiement, puis libérée si le paiement est
          abandonné.
        </p>
      </div>
    </AdminForm>
  );
}
