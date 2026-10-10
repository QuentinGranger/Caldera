'use client';
import { useEffect, useRef } from 'react';

/** Decorative only: the HTML photograph and zoom never depend on WebGL. */
export function ProductStage({
  enabled,
  imageUrl,
}: {
  enabled: boolean;
  imageUrl: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const surface = canvas.current;
    const root = surface?.parentElement;
    if (
      !enabled ||
      !surface ||
      !root ||
      !('IntersectionObserver' in window) ||
      !('ResizeObserver' in window)
    )
      return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const size = matchMedia('(min-width: 360px) and (min-height: 500px)');
    let cleanup: (() => void) | undefined;
    let generation = 0,
      stopped = false,
      nearby = false,
      loading = false;
    const reset = () => {
      generation++;
      cleanup?.();
      cleanup = undefined;
      loading = false;
    };
    const start = async () => {
      const photo = root.querySelector('img');
      if (
        !photo?.complete ||
        !photo.naturalWidth ||
        stopped ||
        loading ||
        cleanup ||
        !nearby ||
        motion.matches ||
        !size.matches
      )
        return;
      loading = true;
      const current = ++generation;
      try {
        const { mountProductStage } = await import('@/lib/three/product-stage');
        if (stopped || current !== generation) return;
        const dispose = mountProductStage(root, surface, photo);
        if (stopped || current !== generation) dispose();
        else cleanup = dispose;
      } catch {
        // Keep the existing product photograph, zoom and static scenery.
      } finally {
        if (current === generation) loading = false;
      }
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        nearby = Boolean(entry?.isIntersecting);
        if (nearby) void start();
      },
      { rootMargin: '200px' },
    );
    observer.observe(root);
    const photoLoaded = () => {
      void start();
    };
    root.addEventListener('load', photoLoaded, true);
    const preference = () => {
      reset();
      void start();
    };
    motion.addEventListener('change', preference);
    size.addEventListener('change', preference);
    return () => {
      stopped = true;
      observer.disconnect();
      root.removeEventListener('load', photoLoaded, true);
      motion.removeEventListener('change', preference);
      size.removeEventListener('change', preference);
      reset();
    };
  }, [enabled, imageUrl]);
  return <canvas ref={canvas} data-product-canvas aria-hidden="true" />;
}
