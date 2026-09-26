import Link from 'next/link';
import { Fragment } from 'react';
import type { Fact } from './landingText';

/** Factual intro: one paragraph per fact, links only to indexable pages. */
export function LandingFacts({ facts }: { facts: readonly Fact[] }) {
  return (
    <>
      {facts.map((fact, index) => (
        <p key={index}>
          {fact.map((part, partIndex) =>
            typeof part === 'string' ? (
              <Fragment key={partIndex}>{part}</Fragment>
            ) : (
              <Link key={partIndex} href={part.href}>
                {part.text}
              </Link>
            ),
          )}
        </p>
      ))}
    </>
  );
}
