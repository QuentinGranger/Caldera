'use client';
import { useEffect, useRef, useState } from 'react';
import { Download, Mail, Monitor, Smartphone } from 'lucide-react';
import styles from './NewsletterCampaignEditor.module.scss';
export function NewsletterEmailPreview({
  rendered,
  subject,
  preheader,
  device: controlledDevice,
  onDevice,
  downloadable = true,
}: {
  rendered: { html: string; text: string };
  subject: string;
  preheader: string;
  device?: 'desktop' | 'mobile' | 'text';
  onDevice?: (device: 'desktop' | 'mobile' | 'text') => void;
  downloadable?: boolean;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(640);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setCanvasWidth(entry.contentRect.width);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  const [localDevice, setLocalDevice] = useState<'desktop' | 'mobile' | 'text'>(
    'desktop',
  );
  const device = controlledDevice ?? localDevice;
  const setDevice = (next: 'desktop' | 'mobile' | 'text') => {
    setLocalDevice(next);
    onDevice?.(next);
  };
  // Preview uses the production renderer. Relative image URLs let local QA use its own media.
  const html = rendered.html
    .replaceAll('src="https://lesterresdecaldera.fr/', 'src="/')
    .replace('<head>', '<head><base target="_blank">');
  const frameWidth = device === 'mobile' ? 375 : 640;
  const frameScale = Math.min(1, canvasWidth / frameWidth);
  function download() {
    const url = URL.createObjectURL(
      new Blob([rendered.html], { type: 'text/html;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'caldera-newsletter.html';
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <aside className={styles.previewPanel} aria-label="Aperçu de la campagne">
      <div className={styles.previewTop}>
        <div>
          <span className={styles.eyebrow}>EN DIRECT</span>
          <h2>Aperçu de l’e-mail</h2>
        </div>
        {downloadable && (
          <button
            type="button"
            className={styles.iconButton}
            aria-label="Télécharger l’e-mail HTML"
            title="Télécharger le HTML"
            onClick={download}
          >
            <Download size={17} />
          </button>
        )}
      </div>
      <div
        className={styles.devices}
        role="group"
        aria-label="Format de l’aperçu"
      >
        <button
          type="button"
          aria-pressed={device === 'desktop'}
          onClick={() => setDevice('desktop')}
        >
          <Monitor size={16} /> Ordinateur
        </button>
        <button
          type="button"
          aria-pressed={device === 'mobile'}
          onClick={() => setDevice('mobile')}
        >
          <Smartphone size={16} /> Mobile
        </button>
        <button
          type="button"
          aria-pressed={device === 'text'}
          onClick={() => setDevice('text')}
        >
          Texte
        </button>
      </div>
      <div className={styles.inbox}>
        <span className={styles.avatar}>
          <Mail size={18} />
        </span>
        <div>
          <strong>Les Terres de Caldera</strong>
          <b>{subject || 'L’objet apparaîtra ici'}</b>
          <span>
            {preheader || 'Ajoutez un aperçu pour donner envie d’ouvrir.'}
          </span>
        </div>
      </div>
      <div className={styles.previewCanvas} ref={canvasRef}>
        {device === 'text' ? (
          <pre className={styles.plainText}>{rendered.text}</pre>
        ) : (
          <div
            className={styles.frameShell}
            style={{ width: frameWidth * frameScale, height: 900 * frameScale }}
          >
            <iframe
              className={`${styles.emailFrame} ${device === 'mobile' ? styles.mobileFrame : ''}`}
              style={{
                width: frameWidth,
                height: 900,
                transform: `scale(${frameScale})`,
                transformOrigin: 'top left',
              }}
              title={`Aperçu e-mail ${device === 'mobile' ? 'mobile' : 'ordinateur'}`}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              srcDoc={html}
            />
          </div>
        )}
      </div>
      <p className={styles.previewNote}>
        Même modèle que l’envoi réel. Le pied de page inclut vos réseaux et la
        désinscription ; un test en boîte mail reste recommandé.
      </p>
    </aside>
  );
}
