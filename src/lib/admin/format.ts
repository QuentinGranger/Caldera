export const labels: Record<string, string> = {
  ORDER_PREPARATION_STARTED: 'Préparation commencée',
  ORDER_READY_TO_SHIP: 'Commande prête à expédier',
  ORDER_SHIPPED: 'Commande expédiée',
  ORDER_DELIVERED: 'Livraison confirmée manuellement',
  SHIPMENT_CREATED: 'Expédition créée',
  SHIPMENT_UPDATED: 'Brouillon d’expédition modifié',
  SHIPMENT_TRACKING_UPDATED: 'Suivi corrigé',
  EMAIL_RETRY_REQUESTED: 'Nouvelle tentative d’email demandée',
  UNFULFILLED: 'À préparer',
  PREPARING: 'En préparation',
  READY_TO_SHIP: 'Prête à expédier',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  PENDING: 'En attente',
  SENDING: 'Envoi en cours',
  SENT: 'Envoyé',
  DRAFT: 'Brouillon',
  ACTIVE: 'Actif',
  ARCHIVED: 'Archivé',
  PENDING_PAYMENT: 'En attente de paiement',
  PAYMENT_PROCESSING: 'Paiement en cours',
  PAID: 'Payée',
  PAYMENT_FAILED: 'Paiement échoué',
  PAYMENT_REVIEW: 'À vérifier',
  CANCELLED: 'Annulée',
  EXPIRED: 'Expirée',
  REQUIRES_PAYMENT_METHOD: 'Moyen de paiement attendu',
  REQUIRES_ACTION: 'Authentification attendue',
  PROCESSING: 'En cours',
  SUCCEEDED: 'Réussi',
  FAILED: 'Échoué',
  CONSUMED: 'Consommée',
  RELEASED: 'Libérée',
  RESTOCK: 'Réapprovisionnement',
  CORRECTION: 'Correction',
  DAMAGE: 'Dommage',
  LOSS: 'Perte',
  RETURN: 'Retour',
  MANUAL: 'Manuel',
  BOOSTER: 'Booster',
  BLISTER: 'Blister',
  TRIPACK: 'Tripack',
  BUNDLE: 'Bundle',
  DISPLAY: 'Display',
  ETB: 'Coffret Dresseur Élite',
  COLLECTION_BOX: 'Coffret collection',
  TIN: 'Boîte métal',
  DECK: 'Deck',
  ACCESSORY: 'Accessoire',
  SINGLE_CARD: 'Carte à l’unité',
  OTHER: 'Autre',
  FR: 'Français',
  EN: 'Anglais',
  JP: 'Japonais',
  DE: 'Allemand',
  ES: 'Espagnol',
  IT: 'Italien',
  NEW: 'Neuf',
  PRODUCT_CREATED: 'Produit créé',
  PRODUCT_UPDATED: 'Produit modifié',
  PRODUCT_STATUS_CHANGED: 'Publication modifiée',
  VARIANT_CREATED: 'Variante créée',
  VARIANT_UPDATED: 'Prix / variante modifiés',
  STOCK_ADJUSTED: 'Stock ajusté',
  IMAGE_UPLOADED: 'Image ajoutée',
  IMAGE_UPDATED: 'Image modifiée',
  IMAGE_REMOVED: 'Image retirée',
  CATEGORY_SAVED: 'Catégorie enregistrée',
  SET_SAVED: 'Extension enregistrée',
  ORDER_NOTE_UPDATED: 'Note interne modifiée',
  ORDER_CANCELLATION_REQUESTED: 'Annulation demandée',
  ORDER_CANCELLATION_RESULT: 'Résultat d’annulation',
};
export function label(value: string) {
  return labels[value] ?? value;
}
export function formatDate(value: Date | string | null) {
  return value
    ? new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Europe/Paris',
      }).format(new Date(value))
    : '—';
}
export function euros(value: { toString(): string } | number | null) {
  return value === null
    ? '—'
    : new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
      }).format(Number(value.toString()));
}
export function dateInput(value: Date | null | undefined) {
  return value?.toISOString().slice(0, 10) ?? '';
}
