'use client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { CircleAlert, Upload } from 'lucide-react';
import {
  finishUploadAction,
  startImportAction,
  uploadChunkAction,
} from '@/lib/supplier-import/admin-actions';
import styles from './Admin.module.scss';
import local from './SupplierImport.module.scss';

const MAX_SIZE = 20 * 1024 * 1024;
const ACCEPT = '.csv,.txt,.tsv,.xlsx,.xlsm,.xls,.pdf,.json';

type Phase =
  | { step: 'idle' }
  | { step: 'hashing' }
  | { step: 'sending'; done: number; total: number }
  | { step: 'reading' }
  | { step: 'error'; message: string };

async function sha256(file: File) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    await file.arrayBuffer(),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * The file travels in chunks (the host limits each request to 4.5 MB),
 * with its SHA-256 checked by the server once complete.
 */
export function SupplierUpload({
  suppliers,
  supplierId,
}: {
  suppliers: { id: string; name: string; code: string }[];
  supplierId: string;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ step: 'idle' });
  const busy = phase.step !== 'idle' && phase.step !== 'error';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('file');
    if (!(file instanceof File) || !file.size) {
      setPhase({ step: 'error', message: 'Choisissez un fichier.' });
      return;
    }
    if (file.size > MAX_SIZE) {
      setPhase({
        step: 'error',
        message: 'Fichier trop lourd (20 Mo maximum) : découpez-le.',
      });
      return;
    }
    try {
      setPhase({ step: 'hashing' });
      const started = await startImportAction({
        supplierId: String(form.get('supplierId')),
        fileName: file.name,
        fileSize: file.size,
        fileHash: await sha256(file),
        scope: String(form.get('scope')),
      });
      if (!started.ok) {
        setPhase({ step: 'error', message: started.message });
        return;
      }
      const total = Math.ceil(file.size / started.chunkSize);
      for (let index = 0; index < total; index++) {
        setPhase({ step: 'sending', done: index, total });
        const chunk = new FormData();
        chunk.set('id', started.id);
        chunk.set('index', String(index));
        chunk.set(
          'chunk',
          file.slice(
            index * started.chunkSize,
            (index + 1) * started.chunkSize,
          ),
        );
        let result = await uploadChunkAction(chunk);
        // A dropped connection: the same chunk is simply sent again.
        for (let retry = 0; !result.ok && retry < 2; retry++)
          result = await uploadChunkAction(chunk);
        if (!result.ok) {
          setPhase({ step: 'error', message: result.message });
          return;
        }
      }
      setPhase({ step: 'reading' });
      const finished = await finishUploadAction(started.id);
      if (!finished.ok) {
        setPhase({ step: 'error', message: finished.message });
        return;
      }
      router.push(`/admin/fournisseurs/imports/${started.id}`);
    } catch {
      setPhase({
        step: 'error',
        message: 'Envoi interrompu : vérifiez la connexion puis recommencez.',
      });
    }
  }

  return (
    <form className={local.upload} onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy} className={local.upload}>
        <label>
          Fournisseur
          <select name="supplierId" defaultValue={supplierId} required>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name} ({supplier.code})
              </option>
            ))}
          </select>
        </label>
        <fieldset className={local.scope}>
          <legend>Ce fichier est</legend>
          <label>
            <input type="radio" name="scope" value="FULL" defaultChecked />
            <span>
              Le catalogue complet du fournisseur
              <small>
                Les références déjà connues qui n’y figurent plus seront
                signalées comme disparues (jamais supprimées).
              </small>
            </span>
          </label>
          <label>
            <input type="radio" name="scope" value="PARTIAL" />
            <span>
              Un extrait (nouveautés, promotions, réassort)
              <small>Les autres références ne sont pas touchées.</small>
            </span>
          </label>
        </fieldset>
        <label>
          Fichier — CSV, Excel (.xlsx, .xls), PDF ou JSON, 20 Mo maximum
          <input type="file" name="file" accept={ACCEPT} required />
        </label>
        <p className={styles.muted}>
          Le fichier reste sur les serveurs de la boutique. Rien n’est importé
          avant votre validation de l’aperçu, et aucune page n’est envoyée à un
          service d’IA sans votre demande explicite.
        </p>
        <div className={styles.actions}>
          <button type="submit">
            <Upload size={17} aria-hidden="true" />
            {busy ? 'Envoi…' : 'Envoyer et analyser'}
          </button>
        </div>
      </fieldset>
      {busy && (
        <div className={local.progress} role="status">
          {phase.step === 'hashing' && <span>Préparation du fichier…</span>}
          {phase.step === 'sending' && (
            <>
              <span>
                Envoi : partie {phase.done + 1} sur {phase.total}
              </span>
              <progress max={phase.total} value={phase.done} />
            </>
          )}
          {phase.step === 'reading' && (
            <span>Lecture du fichier et détection des colonnes…</span>
          )}
        </div>
      )}
      {phase.step === 'error' && (
        <p role="alert" className={`${styles.message} ${styles.error}`}>
          <CircleAlert size={17} aria-hidden="true" />
          {phase.message}
        </p>
      )}
    </form>
  );
}
