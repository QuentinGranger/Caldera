'use client';

import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';
import { FolderOpen, ImagePlus, Link2, Upload, X } from 'lucide-react';
import styles from './Admin.module.scss';

export function GameLogoField({
  currentUrl = '',
  maxBytes,
  maxLabel,
  name = 'logo',
  label = 'Logo du jeu',
  onUrlChange,
}: {
  currentUrl?: string;
  maxBytes: number;
  maxLabel: string;
  name?: string;
  label?: string;
  onUrlChange?: (url: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [mode, setMode] = useState<'file' | 'path'>('file');
  const [path, setPath] = useState(currentUrl);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const dragDepth = useRef(0);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function readSelection() {
    const files = input.current?.files;
    const next = files?.[0];
    const message =
      files && files.length > 1
        ? 'Déposez une seule image.'
        : next &&
            (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type) ||
              !/\.(jpe?g|png|webp)$/i.test(next.name))
          ? 'Choisissez une image JPEG, PNG ou WebP.'
          : next && (!next.size || next.size > maxBytes)
            ? `Image vide ou trop lourde : ${maxLabel} maximum.`
            : '';
    input.current?.setCustomValidity(message);
    setError(message);
    setFile(message ? null : (next ?? null));
    setPreview(message || !next ? null : URL.createObjectURL(next));
    setPreviewFailed(false);
  }
  function clearFile(forceChange = false) {
    if (input.current) {
      const changed = Boolean(input.current.files?.length || error);
      input.current.value = '';
      if (changed || forceChange)
        input.current.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  const source =
    preview ??
    (/^\/(?:assets\/[a-zA-Z0-9_./-]+|media\/[a-f0-9-]+\.webp)$/.test(path) &&
    !path.includes('..')
      ? path
      : null);
  return (
    <section className={styles.gameLogoField} aria-labelledby={`${id}-title`}>
      <header>
        <div>
          <h3 id={`${id}-title`}>{label}</h3>
          <p>
            Importez une image depuis votre ordinateur ou utilisez une image
            déjà présente sur le site.
          </p>
        </div>
      </header>
      <div className={styles.logoModes} aria-label="Source de l’image">
        <button
          type="button"
          aria-pressed={mode === 'file'}
          aria-controls={`${id}-file-panel`}
          onClick={() => setMode('file')}
        >
          <FolderOpen size={16} aria-hidden="true" />
          Depuis l’ordinateur
        </button>
        <button
          type="button"
          aria-pressed={mode === 'path'}
          aria-controls={`${id}-path-panel`}
          onClick={() => {
            clearFile();
            setMode('path');
          }}
        >
          <Link2 size={16} aria-hidden="true" />
          Image du site
        </button>
      </div>
      <div className={styles.logoWorkspace}>
        <div className={styles.logoPreview}>
          {source && !previewFailed ? (
            <Image
              src={source}
              alt={`Aperçu : ${label}`}
              width={160}
              height={110}
              unoptimized
              onError={() => setPreviewFailed(true)}
            />
          ) : (
            <>
              <ImagePlus size={30} aria-hidden="true" />
              <span>
                {previewFailed ? 'Aperçu indisponible' : 'Aucune image'}
              </span>
            </>
          )}
        </div>
        <div>
          <div id={`${id}-file-panel`} hidden={mode !== 'file'}>
            <div
              className={styles.logoDropzone}
              data-dragging={dragging || undefined}
              onDragEnter={(event) => {
                event.preventDefault();
                dragDepth.current++;
                setDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                dragDepth.current--;
                if (dragDepth.current <= 0) setDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                dragDepth.current = 0;
                setDragging(false);
                if (!event.dataTransfer.files.length) return;
                if (input.current && !input.current.matches(':disabled')) {
                  input.current.files = event.dataTransfer.files;
                  input.current.dispatchEvent(
                    new Event('change', { bubbles: true }),
                  );
                }
              }}
            >
              <Upload size={22} aria-hidden="true" />
              <strong>Glissez votre image ici</strong>
              <span>ou sélectionnez-la dans vos fichiers</span>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => input.current?.click()}
              >
                Choisir un fichier
              </button>
              <input
                ref={input}
                id={`${id}-file`}
                className={styles.visuallyHidden}
                type="file"
                name={`${name}File`}
                accept="image/jpeg,image/png,image/webp"
                aria-label={`Fichier : ${label}`}
                aria-describedby={`${id}-help ${id}-error`}
                aria-invalid={Boolean(error)}
                onChange={readSelection}
              />
            </div>
            <small id={`${id}-help`}>
              JPEG, PNG ou WebP · {maxLabel} maximum. L’image sera envoyée lors
              de l’enregistrement.
            </small>
            <small>
              Pour utiliser un chemin du Mac, cliquez sur « Choisir un fichier
              », puis utilisez ⌘⇧G dans le sélecteur pour coller ce chemin.
            </small>
          </div>
          <div id={`${id}-path-panel`} hidden={mode !== 'path'}>
            <label>
              Adresse de l’image sur le site
              <input
                name={`${name}Url`}
                value={path}
                onChange={(event) => {
                  setPath(event.target.value);
                  onUrlChange?.(event.target.value);
                  setPreviewFailed(false);
                }}
                placeholder="/assets/images/... ou /media/..."
                maxLength={500}
              />
            </label>
            <small>
              Utilisez une image déjà publiée sur Caldera. Pour un fichier de
              votre ordinateur, choisissez l’import ci-dessus.
            </small>
          </div>
          <p
            id={`${id}-error`}
            role={error ? 'alert' : undefined}
            className={
              error
                ? `${styles.message} ${styles.error}`
                : styles.visuallyHidden
            }
          >
            {error}
          </p>
          {file && (
            <p className={styles.logoSelection} role="status">
              <span>
                <strong>{file.name}</strong>
                <small>{Math.ceil(file.size / 1024)} Ko · prêt à envoyer</small>
              </span>
              <button
                type="button"
                className={styles.quietButton}
                onClick={() => clearFile()}
                aria-label="Annuler le fichier choisi"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </p>
          )}
          {!file && path && (
            <button
              type="button"
              className={styles.quietButton}
              onClick={() => {
                setPath('');
                onUrlChange?.('');
                setPreviewFailed(false);
                clearFile(true);
              }}
            >
              Retirer l’image
            </button>
          )}
          {error && (
            <button
              type="button"
              className={styles.quietButton}
              onClick={() => clearFile()}
            >
              Annuler la sélection invalide
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
