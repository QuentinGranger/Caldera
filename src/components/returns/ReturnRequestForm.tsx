'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import {
  requestReturnAction,
  type ReturnFormState,
} from '@/lib/returns/actions';
import { shrinkPhoto } from './shrinkPhoto';
import styles from './Returns.module.scss';

const MAX_PHOTOS = 3;
/** Under the server's request limit (6 MB), with room for the form. */
const MAX_PHOTOS_BYTES = 5.5 * 1024 * 1024;

export type ReturnableLine = {
  id: string;
  name: string;
  quantity: number;
  left: number;
};

const initial: ReturnFormState = { success: false, message: '' };

/**
 * Withdrawal or return declared from the order page. The withdrawal button
 * carries the wording of the law: « Confirmer ma rétractation ».
 */
export function ReturnRequestForm({
  publicId,
  access,
  lines,
  canWithdraw,
  canReport,
  closed = false,
}: {
  publicId: string;
  access: string;
  lines: ReturnableLine[];
  canWithdraw: boolean;
  canReport: boolean;
  /**
   * Nothing left to declare online. Kept mounted all the same: a request
   * that took the last items keeps its confirmation on screen.
   */
  closed?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    requestReturnAction,
    initial,
  );
  const [reason, setReason] = useState(canWithdraw ? 'WITHDRAWAL' : 'DAMAGED');
  const message = useRef<HTMLParagraphElement>(null);
  const [photos, setPhotos] = useState<{ name: string; url: string }[]>([]);
  const [photoNote, setPhotoNote] = useState('');
  useEffect(() => {
    if (state.message) message.current?.focus();
  }, [state]);
  // Previews live as long as they are shown.
  useEffect(
    () => () => photos.forEach((photo) => URL.revokeObjectURL(photo.url)),
    [photos],
  );
  async function preparePhotos(input: HTMLInputElement) {
    const picked = [...(input.files ?? [])];
    setPhotoNote('');
    if (picked.length > MAX_PHOTOS) {
      input.value = '';
      setPhotos([]);
      setPhotoNote(`${MAX_PHOTOS} photos au plus : choisissez-les à nouveau.`);
      return;
    }
    const ready = await Promise.all(picked.map(shrinkPhoto));
    if (ready.reduce((sum, file) => sum + file.size, 0) > MAX_PHOTOS_BYTES) {
      input.value = '';
      setPhotos([]);
      setPhotoNote(
        'Ces photos sont trop lourdes : choisissez-en moins, ou des captures d’écran.',
      );
      return;
    }
    try {
      const transfer = new DataTransfer();
      for (const file of ready) transfer.items.add(file);
      input.files = transfer.files;
    } catch {
      // Older browsers keep the originals; the server still resizes them.
    }
    setPhotos(
      ready.map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    );
  }
  const withdrawal = reason === 'WITHDRAWAL';
  return (
    <>
      {state.message && (
        <p
          ref={message}
          tabIndex={-1}
          role={state.success ? 'status' : 'alert'}
          className={state.success ? styles.success : styles.error}
        >
          {state.message}
        </p>
      )}
      {!state.success && closed && (
        <p className={styles.hint}>
          Aucun article de cette commande ne peut plus faire l’objet d’une
          demande en ligne. Écrivez-nous à contact@lesterresdecaldera.fr pour
          toute question.
        </p>
      )}
      {!state.success && !closed && (
        <form action={formAction} className={styles.form}>
          <input type="hidden" name="publicId" value={publicId} />
          <input type="hidden" name="access" value={access} />
          <fieldset>
            <legend>Motif</legend>
            {canWithdraw && (
              <label className={styles.choice}>
                <input
                  type="radio"
                  name="reason"
                  value="WITHDRAWAL"
                  checked={withdrawal}
                  onChange={() => setReason('WITHDRAWAL')}
                />
                <span>
                  <strong>Je me rétracte</strong>
                  <small>
                    Sans avoir à vous justifier, dans les 14 jours suivant la
                    réception.
                  </small>
                </span>
              </label>
            )}
            {canReport &&
              (
                [
                  ['DAMAGED', 'Un article est arrivé abîmé'],
                  ['DEFECTIVE', 'Un article est défectueux ou non conforme'],
                  [
                    'WRONG_ITEM',
                    'J’ai reçu un autre article que celui commandé',
                  ],
                  ['OTHER', 'Autre demande de retour'],
                ] as const
              ).map(([value, text]) => (
                <label key={value} className={styles.choice}>
                  <input
                    type="radio"
                    name="reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                  />
                  <span>
                    <strong>{text}</strong>
                  </span>
                </label>
              ))}
          </fieldset>
          <fieldset>
            <legend>Articles concernés</legend>
            {lines.map((line) => (
              <label key={line.id} className={styles.line}>
                <span>
                  {line.name}
                  <small>
                    {line.left
                      ? `${line.left} sur ${line.quantity} à retourner au plus`
                      : 'Déjà retourné ou remboursé'}
                  </small>
                </span>
                <select
                  name={`qty:${line.id}`}
                  defaultValue={String(line.left)}
                  disabled={!line.left}
                  aria-label={`Quantité à retourner pour ${line.name}`}
                >
                  {Array.from({ length: line.left + 1 }, (_, count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </fieldset>
          <label className={styles.message}>
            {withdrawal ? 'Un message — facultatif' : 'Décrivez le problème'}
            <textarea
              name="message"
              maxLength={2000}
              rows={4}
              required={!withdrawal}
            />
          </label>
          {!withdrawal && (
            <div className={styles.photos}>
              <label className={styles.message} htmlFor="return-photos">
                Photos — facultatif, {MAX_PHOTOS} au plus
              </label>
              <input
                id="return-photos"
                type="file"
                name="photos"
                accept="image/jpeg,image/png,image/webp"
                multiple
                aria-describedby="return-photos-hint"
                onChange={(event) => void preparePhotos(event.currentTarget)}
              />
              <p id="return-photos-hint" className={styles.hint}>
                Un article abîmé ou une erreur se voient mieux en photo : le
                colis, l’emballage, le défaut. Elles ne servent qu’à traiter
                votre demande.
              </p>
              {photoNote && (
                <p role="alert" className={styles.error}>
                  {photoNote}
                </p>
              )}
              {photos.length > 0 && (
                <ul className={styles.previews} aria-label="Photos choisies">
                  {photos.map((photo) => (
                    <li key={photo.url}>
                      {/* A local preview (blob:), never sent anywhere else. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={photo.name} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <button type="submit" disabled={pending}>
            {pending
              ? 'Enregistrement…'
              : withdrawal
                ? 'Confirmer ma rétractation'
                : 'Envoyer ma demande'}
          </button>
          <p className={styles.hint}>
            Un accusé de réception vous est envoyé par e-mail. N’expédiez rien
            avant de l’avoir lu : il indique l’adresse de retour.
          </p>
        </form>
      )}
    </>
  );
}
