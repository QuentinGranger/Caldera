'use client';

import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';
import { observeAureval } from '@/lib/motion/aureval';
import styles from './AurevalScene.module.scss';

const lamps = [
  [1060, 300],
  [980, 360],
  [1190, 277],
  [1278, 218],
  [1405, 113],
  [1454, 141],
];
const ripples = [
  'M 1118 399 Q 1134 396 1151 399',
  'M 1125 408 Q 1140 405 1158 408',
  'M 490 548 Q 520 545 550 548 T 598 548',
  'M 642 603 Q 676 599 710 603 T 755 603',
  'M 707 651 Q 750 647 792 651 T 850 651',
  'M 810 709 Q 852 705 900 709 T 971 709',
  'M 862 775 Q 916 771 969 775 T 1045 775',
  'M 923 837 Q 978 833 1036 837 T 1122 837',
];

function Photo({ source }: { source: string | undefined }) {
  return <image href={source} x="0" y="0" width="1672" height="941" />;
}

/** One cached photograph, two feathered planes, and local SVG light effects. */
export function AurevalScene() {
  const scene = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState<string>();
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  useEffect(() => {
    if (scene.current && source) return observeAureval(scene.current);
  }, [source]);
  return (
    <div
      ref={scene}
      className={styles.scene}
      aria-hidden="true"
      data-aureval-scene
    >
      <Image
        src="/assets/images/editorial/aureval.webp"
        alt=""
        fill
        sizes="(max-width: 767px) 180vw, 100vw"
        className={styles.poster}
        onLoad={(event) => setSource(event.currentTarget.currentSrc)}
      />
      <svg
        viewBox="0 0 1672 941"
        preserveAspectRatio="xMidYMid slice"
        className={styles.canvas}
        focusable="false"
      >
        <defs>
          <filter
            id={`${id}-feather`}
            x="0"
            y="0"
            width="1672"
            height="941"
            filterUnits="userSpaceOnUse"
          >
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <mask
            id={`${id}-terrace`}
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="1672"
            height="941"
          >
            <path
              d="M0 0H540L474 98 452 245 355 410 390 585 520 710 800 941H0Z"
              fill="white"
              filter={`url(#${id}-feather)`}
            />
          </mask>
          <clipPath id={`${id}-river`}>
            <path d="M390 500Q560 490 790 564L1280 775 1160 941H480L610 740Z" />
            <ellipse cx="1138" cy="404" rx="31" ry="13" />
          </clipPath>
          <radialGradient id={`${id}-glow`}>
            <stop stopColor="#ffe3a0" stopOpacity="0.75" />
            <stop offset="1" stopColor="#ffd075" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Overscan belongs inside the fixed frame, including its edge mask. */}
        <g transform="translate(-33.44 -18.82) scale(1.04)">
          <g data-aureval-far>
            <Photo source={source} />
            <g className={styles.effects}>
              <g clipPath={`url(#${id}-river)`} className={styles.ripples}>
                {ripples.map((d) => (
                  <path key={d} d={d} data-aureval-ripple />
                ))}
              </g>
              <g className={styles.lamps}>
                {lamps.map(([x, y], index) => (
                  <g key={index} data-aureval-lamp>
                    <circle cx={x} cy={y} r="12" fill={`url(#${id}-glow)`} />
                    <circle cx={x} cy={y} r="2.2" fill="#ffe9b7" />
                  </g>
                ))}
              </g>
            </g>
          </g>
          <g data-aureval-near mask={`url(#${id}-terrace)`}>
            <Photo source={source} />
          </g>
        </g>
      </svg>
    </div>
  );
}
