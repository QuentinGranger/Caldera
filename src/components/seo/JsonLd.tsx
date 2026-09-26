import {
  serializeJsonLd,
  type JsonLdGraph,
  type JsonLdNode,
} from '@/lib/seo/jsonld';

/** Structured data block; a lone node receives the schema.org context. */
export function JsonLd({
  data,
}: {
  data: JsonLdGraph | JsonLdNode | null | undefined;
}) {
  if (!data) return null;
  const document =
    '@context' in data ? data : { '@context': 'https://schema.org', ...data };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(document) }}
    />
  );
}
