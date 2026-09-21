'use client';
import { useState } from 'react';
import { MapPin, PackageCheck, Search } from 'lucide-react';
import { selectPickupPointAction } from '@/lib/checkout/actions';
import type { CheckoutPickupPointView } from '@/lib/checkout/types';
import type { PickupPoint } from '@/lib/shipping/types';
import { useCheckoutAction } from './useCheckoutAction';
import styles from './Checkout.module.scss';

export function PickupPointSelector({
  sessionId,
  countryCode,
  initialPostalCode,
  initialCity,
  selected,
}: {
  sessionId: string;
  countryCode: string;
  initialPostalCode: string;
  initialCity: string;
  selected: CheckoutPickupPointView | null;
}) {
  const [postalCode, setPostalCode] = useState(initialPostalCode);
  const [city, setCity] = useState(initialCity);
  const [points, setPoints] = useState<PickupPoint[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const { pending, result, execute } = useCheckoutAction();

  async function search() {
    if (searching) return;
    setSearching(true);
    setError('');
    try {
      const query = new URLSearchParams({ postalCode, city, countryCode });
      const response = await fetch(
        `/api/shipping/mondial-relay/pickup-points?${query}`,
      );
      const data = (await response.json()) as {
        points?: PickupPoint[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || 'Recherche impossible.');
      setPoints(data.points ?? []);
      if (!data.points?.length)
        setError('Aucun point disponible pour cette recherche.');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'La recherche est momentanément indisponible.',
      );
    } finally {
      setSearching(false);
    }
  }

  return (
    <section className={styles.pickupSelector} aria-labelledby="pickup-title">
      <div className={styles.pickupHeading}>
        <MapPin aria-hidden="true" />
        <div>
          <h2 id="pickup-title">Choisissez votre point de retrait</h2>
          <p>La disponibilité sera vérifiée à nouveau avant enregistrement.</p>
        </div>
      </div>
      {selected && (
        <div className={styles.selectedPickup}>
          <PackageCheck aria-hidden="true" />
          <div>
            <strong>{selected.name}</strong>
            <span>
              {selected.address1}, {selected.postalCode} {selected.city}
            </span>
            <small>Point sélectionné · n° {selected.pointId}</small>
          </div>
        </div>
      )}
      <div className={styles.pickupSearch}>
        <label>
          Code postal
          <input
            value={postalCode}
            onChange={(event) => setPostalCode(event.target.value)}
            inputMode="text"
            autoComplete="postal-code"
            maxLength={10}
          />
        </label>
        <label>
          Ville
          <input
            value={city}
            onChange={(event) => setCity(event.target.value)}
            autoComplete="address-level2"
            maxLength={80}
          />
        </label>
        <button type="button" onClick={search} disabled={searching || pending}>
          <Search size={18} aria-hidden="true" />
          {searching ? 'Recherche…' : 'Rechercher'}
        </button>
      </div>
      <p className={styles.feedback} role="status">
        {error || result?.message}
      </p>
      {points.length > 0 && (
        <ul
          className={styles.pickupResults}
          aria-label="Points de retrait trouvés"
        >
          {points.map((point) => (
            <li key={point.id}>
              <div>
                <span className={styles.pickupType}>
                  {point.type === 'LOCKER' ? 'Locker' : 'Point Relais®'}
                  {point.distanceM !== null ? ` · ${point.distanceM} m` : ''}
                </span>
                <strong>{point.name}</strong>
                <span>{point.address1}</span>
                <span>
                  {point.postalCode} {point.city}
                </span>
              </div>
              <button
                type="button"
                disabled={pending}
                aria-pressed={selected?.pointId === point.id}
                onClick={() =>
                  execute(
                    () => selectPickupPointAction(sessionId, point.id),
                    false,
                  )
                }
              >
                {selected?.pointId === point.id ? 'Sélectionné' : 'Choisir'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
