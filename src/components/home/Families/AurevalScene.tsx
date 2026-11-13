'use client';

import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';
import { observeAureval } from '@/lib/motion/aureval';
import styles from './AurevalScene.module.scss';

const lamps = [
  [1044, 292],
  [1061, 293],
  [1253, 388],
  [1292, 389],
] as const;
const lanterns = [
  [96, 307],
  [41, 374],
  [75, 407],
] as const;
// Short, uneven glints follow open water, away from the quays and boats.
const ripples = [
  'M 1119 401 Q 1128 399 1136 401',
  'M 1133 408 Q 1142 406 1151 408',
  'M 636 582 Q 645 580 655 582',
  'M 670 600 Q 683 598 695 600',
  'M 614 618 Q 624 616 635 618',
  'M 701 633 Q 719 631 736 633',
  'M 745 658 Q 758 656 771 658',
  'M 799 682 Q 815 680 832 682',
  'M 861 708 Q 882 706 901 708',
  'M 953 730 Q 965 728 979 730',
  'M 1023 754 Q 1045 751 1069 754',
  'M 1131 782 Q 1149 779 1168 782',
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
            <path d="M601 562L766 565 796 612 937 649 983 687 1182 741 1228 803 1134 815 1050 776 926 752 789 699 721 650 617 634Z" />
            <ellipse cx="1138" cy="404" rx="31" ry="13" />
          </clipPath>
          <linearGradient id={`${id}-glint`}>
            <stop stopColor="#ffe9b7" stopOpacity="0" />
            <stop offset="0.45" stopColor="#fff0cb" />
            <stop offset="1" stopColor="#ffe9b7" stopOpacity="0" />
          </linearGradient>
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
              <g
                clipPath={`url(#${id}-river)`}
                className={styles.ripples}
                stroke={`url(#${id}-glint)`}
              >
                {ripples.map((d) => (
                  <path key={d} d={d} data-aureval-ripple />
                ))}
              </g>
              <g className={styles.lamps}>
                {lamps.map(([x, y], index) => (
                  <g key={index} data-aureval-lamp>
                    <circle cx={x} cy={y} r="9" fill={`url(#${id}-glow)`} />
                    <rect
                      x={x - 1}
                      y={y - 2}
                      width="2"
                      height="4"
                      rx="0.7"
                      fill="#ffe9b7"
                    />
                  </g>
                ))}
              </g>
            </g>
          </g>
          <g data-aureval-near mask={`url(#${id}-terrace)`}>
            <Photo source={source} />
            <g className={`${styles.effects} ${styles.lanterns}`}>
              {lanterns.map(([x, y]) => (
                <g key={`${x}-${y}`} data-aureval-lamp>
                  <circle cx={x} cy={y} r="22" fill={`url(#${id}-glow)`} />
                  <ellipse cx={x} cy={y} rx="3" ry="7" fill="#ffe4a4" />
                </g>
              ))}
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
